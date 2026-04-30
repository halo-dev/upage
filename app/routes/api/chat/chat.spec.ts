import { describe, expect, it } from 'vitest';
import { resolveChatMetadataForRequest } from './metadata';

describe('resolveChatMetadataForRequest', () => {
  it('should persist a client-selected design system immediately', () => {
    const result = resolveChatMetadataForRequest({
      chatMetadata: null,
      clientDesignMd: '# Airbnb design system',
      designMdRemoved: false,
    });

    expect(result).toEqual({
      nextMetadata: {
        sessionType: 'agent-page-builder',
        designMd: '# Airbnb design system',
      },
      shouldUpdate: true,
    });
  });

  it('should persist manual design system removal', () => {
    const result = resolveChatMetadataForRequest({
      chatMetadata: {
        sessionType: 'agent-page-builder',
        designMd: '# Existing design system',
      },
      designMdRemoved: true,
    });

    expect(result).toEqual({
      nextMetadata: {
        sessionType: 'agent-page-builder',
        designMd: '',
      },
      shouldUpdate: true,
    });
  });

  it('should only normalize session type when design system stays unchanged', () => {
    const result = resolveChatMetadataForRequest({
      chatMetadata: {
        sessionType: 'chat',
        designMd: '# Existing design system',
      },
      designMdRemoved: false,
    });

    expect(result).toEqual({
      nextMetadata: {
        sessionType: 'agent-page-builder',
        designMd: '# Existing design system',
      },
      shouldUpdate: true,
    });
  });

  it('should skip updates when metadata is already current', () => {
    const result = resolveChatMetadataForRequest({
      chatMetadata: {
        sessionType: 'agent-page-builder',
        designMd: '# Existing design system',
      },
      clientDesignMd: '# Existing design system',
      designMdRemoved: false,
    });

    expect(result).toEqual({
      nextMetadata: {
        sessionType: 'agent-page-builder',
        designMd: '# Existing design system',
      },
      shouldUpdate: false,
    });
  });
});
