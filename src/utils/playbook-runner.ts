import * as yaml from 'js-yaml';
import { getConfig } from './config';

export interface PlaybookStep {
  name: string;
  action: string;
  args: Record<string, any>;
  continue_on_error?: boolean;
}

export interface Playbook {
  name: string;
  vars: Record<string, string>;
  steps: PlaybookStep[];
}

export interface PlaybookResult {
  step: string;
  action: string;
  success: boolean;
  message: string;
  skipped?: boolean;
}

export function parsePlaybook(yamlContent: string): Playbook {
  const doc = yaml.load(yamlContent) as any;
  if (!doc || typeof doc !== 'object') throw new Error('Invalid YAML');
  return {
    name: doc.name || 'Unnamed playbook',
    vars: doc.vars || {},
    steps: (doc.steps || []).map((s: any) => ({
      name: s.name || 'Unnamed step',
      action: s.action,
      args: s.args || {},
      continue_on_error: s.continue_on_error || false,
    })),
  };
}

export function validatePlaybook(playbook: Playbook): string[] {
  const errors: string[] = [];
  if (!playbook.name) errors.push('Missing playbook name');
  if (!playbook.steps || playbook.steps.length === 0) errors.push('No steps defined');
  for (let i = 0; i < playbook.steps.length; i++) {
    const step = playbook.steps[i];
    if (!step.action) errors.push(`Step ${i + 1} ("${step.name}"): missing action`);
  }
  return errors;
}

export function substituteVars(
  obj: any,
  context: { vars: Record<string, string>; env: Record<string, string>; config: Record<string, string> },
): any {
  if (typeof obj === 'string') {
    return obj.replace(/\{\{\s*(vars|env|config)\.(\w+)\s*\}\}/g, (match, namespace, key) => {
      const source = context[namespace as keyof typeof context];
      if (source && source[key] !== undefined) return source[key];
      throw new Error(`Undefined variable: ${namespace}.${key}`);
    });
  }
  if (Array.isArray(obj)) return obj.map((item) => substituteVars(item, context));
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = substituteVars(v, context);
    }
    return result;
  }
  return obj;
}

export async function executePlaybook(
  playbook: Playbook,
  actionMap: Record<string, (...args: any[]) => Promise<any>>,
  options: { dryRun?: boolean; vars?: Record<string, string> },
): Promise<PlaybookResult[]> {
  const config = getConfig();
  const context = {
    vars: { ...playbook.vars, ...(options.vars || {}) },
    env: process.env as Record<string, string>,
    config: { server: config.server, domain: config.domain, username: config.username },
  };

  const results: PlaybookResult[] = [];

  for (const step of playbook.steps) {
    const resolvedArgs = substituteVars(step.args, context);
    const actionFn = actionMap[step.action];

    if (!actionFn) {
      results.push({ step: step.name, action: step.action, success: false, message: `Unknown action: ${step.action}` });
      if (!step.continue_on_error) break;
      continue;
    }

    if (options.dryRun) {
      results.push({
        step: step.name,
        action: step.action,
        success: true,
        message: 'Dry run — would execute',
        skipped: true,
      });
      continue;
    }

    try {
      await actionFn(resolvedArgs);
      results.push({ step: step.name, action: step.action, success: true, message: 'OK' });
    } catch (err: any) {
      results.push({ step: step.name, action: step.action, success: false, message: err.message });
      if (!step.continue_on_error) break;
    }
  }

  return results;
}
