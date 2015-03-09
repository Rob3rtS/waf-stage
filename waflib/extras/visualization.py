#! /usr/bin/env python
# encoding: utf-8
# Robert Schuster, 2015

"""
Visualization of build dependencie on file level.
Generate JavaScript code for use with:
vis.js: http://visjs.org/index.html
JavaScript InfoVis Toolkit: http://philogb.github.io/jit/

Provide a possibility for explorative visualization of dependencies.
Only files related to targets, which have been built or re-built, will be taken into account.
"""
import binascii
import re
import os
from waflib import Task, Node, Utils, Context

class VisRegistry:
	def __init__(self, bld):
		self.artifacts = {}
		self.framework={}
		self.bld=bld
		if (not 'vis_framework' in bld.env) or ('vis_framework' in bld.env and bld.env['vis_framework'] not in ['jit', 'vis']):
			self.framework['name'] = 'jit'
		else:
			self.framework['name'] = bld.env['vis_framework']
		# framework specific default shape
		if self.framework['name'] == 'vis':
			self.framework['default_shape'] = 'box'
		if self.framework['name'] == 'jit':
			self.framework['default_shape'] = 'circle'
		# list of all encountered file extensions for colorization
		self.file_exts=[]
		if 'vis_default_color' in bld.env:
			# disable color generation
			self.framework['color']=bld.env['vis_default_color']
			if not re.match('#[A-F0-9]{6}$', self.framework['color']):
				raise ValueError('Invalid html color: %s'%self.framework['color'])
		else:
			self.framework['color']={}
	def add_artifact(self, _node):
		self.artifacts[_node.name]=_node
		# unique list of file extensions
		ext=_node.suffix()
		if ext and not ext in self.file_exts:
			self.file_exts.append(ext)
	def get_artifact(self, _name):
		if not _name in self.artifacts:
			return None
		return self.artifacts[_name]
	def get_rootelems(self):
		roots=set()
		for i in self.artifacts.values():
			if not i.vis_parents:
				roots.add(i)
		return roots
	def create_project(self):
		product=getattr(Context.g_module, 'APPNAME', 'noname')
		prod=self.bld.path.find_or_declare(product)
		if not hasattr(prod, 'vis_children'):
			prod.vis_children=set()
		for i in self.get_rootelems():
			prod.vis_children.add(i)
			i.vis_parents.add(prod)
		prod.vis_shape=self.get_shape_map()['root']
		self.add_artifact(prod)
		self.project=prod
	def serialize(self):
		self.create_project()
		arr=[]
		if type(self.framework['color']).__name__ != 'str':
			i=0
			for c in list(itertools.islice(gethtmlcolors(), self.file_exts.__len__())):
				self.framework['color'][self.file_exts[i]]=c
				i+=1
		if self.framework['name'] == 'jit':
			out="var depTreeData=[\n"
			for i in self.artifacts.values():
				arr.append(i.vis_serialize(self.framework))
			out+=','.join(arr)
			out+='];\n'
			out+='var depRootId="%s";\n'%self.project.vis_id()
			out+='var depRootName="%s";\n'%self.project.name
		if self.framework['name'] == 'vis':
			out=\
"""var nodes=[];
var edges=[];
"""
			for i in self.artifacts.values():
				arr.append(i.vis_serialize(self.framework))
			out+=''.join(arr)
			out+=\
"""var data = {
    nodes: nodes,
    edges: edges
};
"""
		return(out)
	def get_shape_map(self):
		types='program stlib shlib root'.split()
		vis_shape_map={}
		if 'vis_shape_flavor' in self.bld.env:
			flavor=self.bld.env['vis_shape_flavor']
		else:
			flavor='mixed'
		if flavor == 'mixed':
			# shapes
			vis_shape_map['program']='circle'
			vis_shape_map['stlib']='ellipse'
			vis_shape_map['shlib']='square'
			vis_shape_map['root']='star'
		if flavor == 'uniform':
			for x in types:
				vis_shape_map[x]=self.framework['default_shape']
		return (vis_shape_map)
	def visualize_nodes(self):
		output='Data.js'
		def tmp(bld):
			Utils.writef(bld.bldnode.abspath()+os.sep+self.framework['name']+output, bld.vis_registry.serialize())
		return tmp


# extend class Task
Task.Task.old_post_run=Task.Task.post_run
def new_post_run(self):
	self.old_post_run()
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
	for dep in expl_deps + impl_deps:
		if not hasattr(dep, 'vis_parents'):
			dep.vis_parents=set()
		dep.vis_parents.update(set(self.outputs))
		vr.add_artifact(dep)
	for out in self.outputs:
		if not hasattr(out, 'vis_children'):
			out.vis_children=set()
		out.vis_children.update(expl_deps + impl_deps)
		vr.add_artifact(out)
	# assign shapes
	this_class=type(self).__name__
	for s in vr.get_shape_map().keys():
		if re.search(s, this_class):
			for o in self.outputs:
				o.vis_shape=vr.get_shape_map()[s]

Task.Task.post_run=new_post_run

# extend class Node
Node.Node.old__init__=Node.Node.__init__
def vis__init__(self, name, parent):
	self.old__init__(name, parent)
	self.vis_children=set()
	self.vis_parents=set()
def vis_get_deps(self):
	return self.vis_children
def vis_get_parents(self):
	return self.vis_parents
def vis_id(self):
	m=Utils.md5()
	m.update(self.abspath().encode())
	return binascii.hexlify(m.digest()).decode()
def vis_serialize(self, framework):
	out=''
	if not getattr(self, 'vis_shape', ''):
		self.vis_shape=framework['default_shape']
	try:
		if type(framework['color']).__name__ == 'dict':
			color=framework['color'][self.suffix()]
		else:
			color=framework['color']
	except KeyError:
		# fallback
		color='#CCBBBB'
	if framework['name'] == 'jit':
		arr=[]
		out+=\
""" {
"id": "%s",
"name": "%s",
"data": {
"$dim": 10,
"$type": "%s",
"$color": "%s"
},
"""%(self.vis_id(), self.name, self.vis_shape, color)

		if(self.vis_parents or self.vis_children):
			out+='"adjacencies": [\n'
			if(self.vis_parents):
				for d in self.vis_parents:
					adj=\
"""{
"nodeTo": "%s",
"data": {
"weight": 1,
"$type":"arrow",
"$direction": ["%s", "%s"]
}
}
"""%(d.vis_id(), self.vis_id(), d.vis_id())
					arr.append(adj)
			if(self.vis_children):
				for d in self.vis_children:
					adj=\
"""{
"nodeTo": "%s",
"data": {
"weight": 1,
"$type":"arrow",
"$direction": ["%s", "%s"]
}
}"""%(d.vis_id(), d.vis_id(), self.vis_id())
					arr.append(adj)
			out+=',\n'.join(arr)
			out+=']\n'
		out+='}\n'
	if framework['name'] == 'vis':
		out+='nodes.push({id: "%s", label: "%s", shape: "%s", color: "%s"});\n'%(self.vis_id(), self.name, self.vis_shape, color)
		if(self.vis_children):
			for d in self.vis_children:
				out+='edges.push({from: "%s", to: "%s"});\n'%(d.vis_id(), self.vis_id())
	return(out)

Node.Node.__init__=vis__init__
Node.Node.vis_serialize=vis_serialize
Node.Node.vis_get_deps=vis_get_deps
Node.Node.vis_get_parents=vis_get_parents
Node.Node.vis_id=vis_id

#################
# Color Generator
#################
# copied from http://stackoverflow.com/questions/470690/how-to-automatically-generate-n-distinct-colors

import colorsys
import itertools
from fractions import Fraction

def zenos_dichotomy():
	"""
	http://en.wikipedia.org/wiki/1/2_%2B_1/4_%2B_1/8_%2B_1/16_%2B_%C2%B7_%C2%B7_%C2%B7
	"""
	for k in itertools.count():
		yield Fraction(1,2**k)

def getfracs():
	"""
	[Fraction(0, 1), Fraction(1, 2), Fraction(1, 4), Fraction(3, 4), Fraction(1, 8), Fraction(3, 8), Fraction(5, 8), Fraction(7, 8), Fraction(1, 16), Fraction(3, 16), ...]
	[0.0, 0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875, 0.0625, 0.1875, ...]
	"""
	yield 0
	for k in zenos_dichotomy():
		i = k.denominator # [1,2,4,8,16,...]
		for j in range(1,i,2):
			yield Fraction(j,i)

bias = lambda x: (math.sqrt(x/3)/Fraction(2,3)+Fraction(1,3))/Fraction(6,5) # can be used for the v in hsv to map linear values 0..1 to something that looks equidistant

def genhsv(h):
	for s in [Fraction(6,10)]: # optionally use range
		for v in [Fraction(8,10),Fraction(5,10)]: # could use range too
			yield (h, s, v) # use bias for v here if you use range

genrgb = lambda x: colorsys.hsv_to_rgb(*x)

flatten = itertools.chain.from_iterable

gethsvs = lambda: flatten(map(genhsv,getfracs()))

getrgbs = lambda: map(genrgb, gethsvs())

def genhtml(x):
	#uint8tuple = map(lambda y: '%0.2X'%int(y*255), x)
	uint8tuple = map(lambda y: int(y*255), x)
	return "#{:02X}{:02X}{:02X}".format(*uint8tuple)

gethtmlcolors = lambda: map(genhtml, getrgbs())
