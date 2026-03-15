import { describe, it, expect, beforeAll } from 'vitest';

describe('Playbook Runner', () => {
  let runner: any;
  beforeAll(async () => {
    runner = await import('../dist/utils/playbook-runner');
  });

  it('parsePlaybook should parse valid YAML', () => {
    const pb = runner.parsePlaybook(
      'name: Test\nsteps:\n  - name: Step 1\n    action: test.action\n    args:\n      key: value',
    );
    expect(pb.name).toBe('Test');
    expect(pb.steps.length).toBe(1);
    expect(pb.steps[0].action).toBe('test.action');
  });

  it('validatePlaybook should catch missing steps', () => {
    const errors = runner.validatePlaybook({ name: 'Test', vars: {}, steps: [] });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('No steps');
  });

  it('validatePlaybook should catch missing action', () => {
    const errors = runner.validatePlaybook({ name: 'Test', vars: {}, steps: [{ name: 'S1', args: {} }] });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('missing action');
  });

  it('substituteVars should replace {{ vars.x }}', () => {
    const result = runner.substituteVars('Hello {{ vars.name }}', { vars: { name: 'World' }, env: {}, config: {} });
    expect(result).toBe('Hello World');
  });

  it('substituteVars should replace {{ env.HOME }}', () => {
    const result = runner.substituteVars('Home: {{ env.HOME }}', {
      vars: {},
      env: { HOME: '/users/test' },
      config: {},
    });
    expect(result).toBe('Home: /users/test');
  });

  it('substituteVars should throw on missing var', () => {
    expect(() => runner.substituteVars('{{ vars.missing }}', { vars: {}, env: {}, config: {} })).toThrow(
      'Undefined variable',
    );
  });

  it('executePlaybook dry-run should not execute', async () => {
    const pb = { name: 'Test', vars: {}, steps: [{ name: 'S1', action: 'test', args: {} }] };
    const actionMap = {
      test: async () => {
        throw new Error('should not run');
      },
    };
    const results = await runner.executePlaybook(pb, actionMap, { dryRun: true });
    expect(results[0].skipped).toBe(true);
  });

  it('executePlaybook should stop on failure by default', async () => {
    let callCount = 0;
    const pb = {
      name: 'Test',
      vars: {},
      steps: [
        { name: 'S1', action: 'fail', args: {} },
        { name: 'S2', action: 'ok', args: {} },
      ],
    };
    const actionMap = {
      fail: async () => {
        callCount++;
        throw new Error('fail');
      },
      ok: async () => {
        callCount++;
      },
    };
    const results = await runner.executePlaybook(pb, actionMap, {});
    expect(results.length).toBe(1);
    expect(callCount).toBe(1);
  });

  it('executePlaybook should continue on error when flagged', async () => {
    const pb = {
      name: 'Test',
      vars: {},
      steps: [
        { name: 'S1', action: 'fail', args: {}, continue_on_error: true },
        { name: 'S2', action: 'ok', args: {} },
      ],
    };
    const actionMap = {
      fail: async () => {
        throw new Error('fail');
      },
      ok: async () => {},
    };
    const results = await runner.executePlaybook(pb, actionMap, {});
    expect(results.length).toBe(2);
  });
});
