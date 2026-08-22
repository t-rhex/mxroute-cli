import { describe, expect, it } from 'vitest';

describe('server hostname formatting', () => {
  it('expands a short MXroute server name', () => {
    const { toServerHostname } = require('../dist/utils/shared');
    expect(toServerHostname('fusion')).toBe('fusion.mxrouting.net');
  });

  it('preserves a fully qualified API server name', () => {
    const { toServerHostname } = require('../dist/utils/shared');
    expect(toServerHostname('fusion.mxrouting.net')).toBe('fusion.mxrouting.net');
  });
});

describe('forwarding loop detection', () => {
  it('does not treat every same-domain destination as a loop', () => {
    const { isDirectForwardingLoop } = require('../dist/utils/shared');
    expect(isDirectForwardingLoop('hello@example.com', 'owner@example.com')).toBe(false);
  });

  it('detects a direct self-forward among multiple destinations', () => {
    const { isDirectForwardingLoop } = require('../dist/utils/shared');
    expect(isDirectForwardingLoop('hello@example.com', 'owner@example.com, HELLO@example.com')).toBe(true);
  });
});
