#! /usr/bin/env python
# encoding: utf-8
# Robert Schuster, 2015

"""
Visualization of build dependencies on file level.
Generate JavaScript code for use with:
vis.js: http://visjs.org/index.html
JavaScript InfoVis Toolkit: http://philogb.github.io/jit/

Provide a possibility for explorative visualization of dependencies.
Only files related to targets, which have been built or re-built, will be taken into account.
"""
import binascii
import re
import os
import json
import random
import colorsys
from waflib import Task, TaskGen, Node, Utils, Context

from waflib.Configure import conf

@conf
def vis_init(ctx):
	ctx.vis_registry=VisRegistry(ctx)

class VisRegistry:
	def __init__(self, bld):
		self.artifacts = {}
		self.tgens = {}
		self.bld=bld
		# list of all encountered file extensions and feature combinations for colorization
		self.color_keys=[]
	def add_artifact(self, _node):
		self.artifacts[_node.vis_id()]=_node
		# unique list of file extensions
		ext=_node.suffix()
		if ext and not ext in self.color_keys:
			self.color_keys.append(ext)
	def add_tgen(self, _tg):
		self.tgens[_tg.vis_id()]=_tg
		# unique list of featuresets
		fp=_tg.vis_featureset
		if fp and not fp in self.color_keys:
			self.color_keys.append(fp)
	def get_rootelems(self):
		roots=set()
		for i in self.artifacts.values():
			if not i.vis_parents:
				roots.add(i)
		return roots
	def create_project(self):
		project=getattr(Context.g_module, 'APPNAME', 'noname')
		self.project=project
		prod=self.bld.path.find_or_declare(project)
		prod.vis_out_of_tgen='rootTG'
		if not hasattr(prod, 'vis_children'):
			prod.vis_children=set()
		for i in self.get_rootelems():
			print('create project - add root elem: %s'%i)
			prod.vis_children.add(i)
			i.vis_parents.add(prod)
			if not hasattr(i, 'vis_in_for_tgen'):
				i.vis_in_for_tgen=set()
			i.vis_in_for_tgen.add('rootTG')
		self.add_artifact(prod)
		self.project=prod
	def serialize_nodes(self):
		self.create_project()
		# convert the objects to a data structure ready for being dumped as json
		jr={}
		for a in self.artifacts:
			# a (the key) is also the id - create a dict of dicts
			art=self.artifacts[a]
			jr[a]={}
			jr[a]['name']=art.name
			#if art.vis_out_of_tgen == 'rootTG':
			jr[a]['visible']='false'
			#else:
			#	jr[a]['visible']='true'
			# might be redundant, but it should unify handling (see self.serialize_tgens())
			jr[a]['colorkey']=art.suffix()
			jr[a]['parents']=[x.vis_id() for x in art.vis_parents]
			jr[a]['children']=[x.vis_id() for x in art.vis_children]
			try:
				jr[a]['out_of_tgen']=list(art.vis_out_of_tgen)
			except:
				# probably happening for the leaf elements
				print('no out_of_tgen for %s'%art.name)
			try:
				jr[a]['in_for_tgen']=list(art.vis_in_for_tgen)
			except:
				# probably happening for the root element
				print('no in_for_tgen for %s'%art.name)
		return json.dumps(jr)
	def serialize_tgens(self):
		# convert the objects to a data structure ready for being dumped as json
		jr={}
		jr['rootTG']={}
		jr['rootTG']['name']=self.project.name
		jr['rootTG']['visible']='true'
		jr['rootTG']['colorkey']='rootTG'
		self.color_keys.append('rootTG')
		for a in self.tgens:
			# a (the key) is also the id - create a dict of dicts
			art=self.tgens[a]
			jr[a]={}
			jr[a]['name']=art.get_name()
			jr[a]['visible']='true'
			jr[a]['colorkey']=art.vis_featureset
		return json.dumps(jr)
	def serialize_colors(self):
		# generate distinct colors
		colors={}
		i=0
		for c in gethtmlcolors(self.color_keys.__len__()):
			colors[self.color_keys[i]]=c
			i+=1
		return json.dumps(colors)
	def visualize_nodes(self):
		# write the data structures to json files
		def tmp(bld):
			Utils.writef(bld.bldnode.abspath()+os.sep+'wafNodes.json', bld.vis_registry.serialize_nodes())
			Utils.writef(bld.bldnode.abspath()+os.sep+'wafTaskGens.json', bld.vis_registry.serialize_tgens())
			Utils.writef(bld.bldnode.abspath()+os.sep+'wafColors.json', bld.vis_registry.serialize_colors())
		return tmp


# extend class Task
Task.Task.old_post_run=Task.Task.post_run
def new_post_run(self):
	self.old_post_run()
	tg=self.generator
	#print(tg.__dict__)
	# explicit deps
	expl_deps=self.inputs + self.dep_nodes
	# omitting manual deps for now
	# implicit deps
	impl_deps=[]
	# default: show also implicit dependencies
	env=self.generator.bld.env
	if not 'vis_show_implicit' in env:
		env['vis_show_implicit']='True'
	if env['vis_show_implicit'] == 'True':
		try:
			impl_deps=self.generator.bld.node_deps[self.uid()]
		except KeyError:
			pass

	# attach attributes to Nodes
	try:
		vr=self.generator.bld.vis_registry
	except:
		# we are in a build context, where vis_registry is missing - likely a configuration check task
		return
	vr.add_tgen(tg)
	for dep in expl_deps + impl_deps:
		if not hasattr(dep, 'vis_parents'):
			dep.vis_parents=set()
		dep.vis_parents.update(set(self.outputs))
		if not hasattr(dep, 'vis_in_for_tgen'):
			dep.vis_in_for_tgen=set()
		# a task gen can have several inputs
		dep.vis_in_for_tgen.add(tg.vis_id())
		vr.add_artifact(dep)
	for out in self.outputs:
		if not hasattr(out, 'vis_children'):
			out.vis_children=set()
		out.vis_children.update(expl_deps + impl_deps)
		# a node can be the output of only a single task gen
		# but a task gen can have several outputs
		out.vis_out_of_tgen=tg.vis_id()
		vr.add_artifact(out)

Task.Task.post_run=new_post_run

# extend class Node
Node.Node.old__init__=Node.Node.__init__
def vis_nd__init__(self, name, parent):
	self.old__init__(name, parent)
	self.vis_children=set()
	self.vis_parents=set()
def vis_nd_get_deps(self):
	return self.vis_children
def vis_nd_get_parents(self):
	return self.vis_parents
def vis_nd_id(self):
	m=Utils.md5()
	m.update(self.abspath().encode())
	return binascii.hexlify(m.digest()).decode()

Node.Node.__init__=vis_nd__init__
Node.Node.vis_get_deps=vis_nd_get_deps
Node.Node.vis_get_parents=vis_nd_get_parents
Node.Node.vis_id=vis_nd_id

# extend class task_gen
TaskGen.task_gen.old__init__=TaskGen.task_gen.__init__
def vis_tg__init__(self, *k, **kw):
	self.old__init__(*k, **kw)
	# use the same color for all task gens with the same sef of features
	self.vis_featureset="_".join(sorted(Utils.to_list(self.features)))
def vis_tg_id(self):
	# assumption: combination of task generator name and its path is usually unique, so use it as ID
	tp=self.path.abspath()+os.sep+self.get_name()
	m=Utils.md5()
	m.update(tp.encode())
	return binascii.hexlify(m.digest()).decode()

TaskGen.task_gen.__init__=vis_tg__init__
TaskGen.task_gen.vis_id=vis_tg_id

#################
# Color Generator
#################
# copied from http://stackoverflow.com/questions/470690/how-to-automatically-generate-n-distinct-colors

def gethtmlcolors(num_colors):
	colors=[]
	#for i in np.arange(0., 360., 360. / num_colors):
	i=0
	while i < 360.:
		hue = i/360.
		lightness = (50 + random.random() * 10)/100.
		saturation = (90 + random.random() * 10)/100.
		colors.append(genhtml(colorsys.hls_to_rgb(hue, lightness, saturation)))
		i+=360. / num_colors
	return colors

def genhtml(x):
	uint8tuple = map(lambda y: int(y*255), x)
	return "#{:02X}{:02X}{:02X}".format(*uint8tuple)
