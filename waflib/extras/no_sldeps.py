#!/usr/bin/env python
# encoding: utf-8
# Robert Schuster, 2015

# Suppress relinking when only sources of a shared lib have changed

from waflib import Task, TaskGen, Logs
from waflib.Utils import to_list, to_hex
from waflib.Tools import c, cxx

def options(opt):
	opt.add_option('--no_sldeps', action='store_true', default=False, help='suppress dependency to shared libraries')

def frozen_sig_explicit_deps(self):
	bld = self.generator.bld
	upd = self.m.update

	# the inputs
	for x in self.inputs + self.dep_nodes:
		if getattr(x, 'frozen', None):
			Logs.debug('no_sldeps: %r is frozen'%x)
			try:
				upd(x.frozen)
			except AttributeError:
				raise Errors.WafError('Unable to retrieve frozen node signature for %r (required by %r)' % (x, self))
		else:
			try:
				upd(x.get_bld_sig())
			except (AttributeError, TypeError):
				raise Errors.WafError('Missing node signature for %r (required by %r)' % (x, self))

	# manual dependencies, they can slow down the builds
	if bld.deps_man:
		additional_deps = bld.deps_man
		for x in self.inputs + self.outputs:
			try:
				d = additional_deps[id(x)]
			except KeyError:
				continue

			for v in d:
				if isinstance(v, bld.root.__class__):
					try:
						v = v.get_bld_sig()
					except AttributeError:
						raise Errors.WafError('Missing node signature for %r (required by %r)' % (v, self))
				elif hasattr(v, '__call__'):
					v = v() # dependency is a function, call it
				upd(v)

	return self.m.digest()

for x in ('cshlib', 'cxxshlib', 'cprogram', 'cxxprogram'):
	try:
		t=Task.classes[x]
		setattr(t, 'sig_explicit_deps', frozen_sig_explicit_deps)
	except KeyError:
		Logs.debug('no_sldeps: failed to override method sig_explicit_deps for class: %s'%x)
		pass

@TaskGen.feature('cshlib', 'cxxshlib')
@TaskGen.after_method('apply_link', 'process_source', 'process_use')
def detect_change(self):
	src_changed=False
	dep_changed=False
	display=self.link_task.outputs[0]
	if self.bld.options.no_sldeps:
		compiled_tasks=[]
		if getattr(self, 'compiled_tasks', []):
			compiled_tasks+=self.compiled_tasks
		if getattr(self, 'use', []):
			for tgn in to_list(self.use):
				tg=self.bld.get_tgen_by_name(tgn)
				compiled_tasks+=tg.compiled_tasks
		if compiled_tasks:
			for tsk in compiled_tasks:
				try:
					sources=tsk.inputs
					for s in sources:
						if to_hex(s.sig) != to_hex(s.get_bld_sig()):
							src_changed=True
							Logs.debug('no_sldeps: src_changed of %r'%display)
							break
					headers=self.bld.node_deps[tsk.uid()]
					for h in headers:
						if to_hex(h.sig) != to_hex(h.get_bld_sig()):
							dep_changed=True
							Logs.debug('no_sldeps: dep_changed of %r'%display)
							break
				except (KeyError, AttributeError):
					Logs.debug('no_sldeps: task: %r - no dep known yet'%tsk.name)
		if src_changed and not dep_changed:
			Logs.debug('no_sldeps: interface of %r did not change'%display)
			try:
				# freeze the sig
				if self.link_task.uid() in self.bld.frozen_sigs:
					Logs.debug('no_sldeps: no re-freezing sig of %r'%display)
				else:
					Logs.debug('no_sldeps: freezing sig of %r'%display)
					self.bld.frozen_sigs[self.link_task.uid()]=self.bld.task_sigs[self.link_task.uid()]
			except KeyError:
				Logs.debug('no_sldeps: failed to freeze sig for %r'%display)
	if dep_changed or not self.bld.options.no_sldeps:
		# unfreeze
		try:
			Logs.debug('no_sldeps: unfreeze sig of %r'%self.link_task.outputs[0])
			del self.bld.frozen_sigs[self.link_task.uid()]
		except KeyError:
			#Logs.debug('failed to unfreeze sig for %r'%display)
			pass

@TaskGen.feature('cshlib', 'cxxshlib')
@TaskGen.after_method('detect_change')
def freeze_nodes(self):
	frozen_sig=None
	try: frozen_sig=self.bld.frozen_sigs[self.link_task.uid()]
	except KeyError: pass
	for out in self.link_task.outputs:
		out.frozen=None
		if self.bld.options.no_sldeps and frozen_sig:
			out.frozen=frozen_sig