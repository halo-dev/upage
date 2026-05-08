import { describe, expect, it } from 'vitest';
import { getChatArtifactSyncState, getChatStateAfterInitialMessage } from './Chat';

describe('getChatArtifactSyncState', () => {
  it('should keep currently displayed message ids when loader data is rewound', () => {
    const result = getChatArtifactSyncState(
      [{ id: 'assistant-rewound' }, { id: 'user-new' }, { id: 'assistant-new' }] as never,
      [{ id: 'assistant-rewound' }] as never,
    );

    expect(result).toEqual({
      displayedMessageIds: ['assistant-rewound', 'user-new', 'assistant-new'],
      reloadedMessageIds: ['assistant-rewound'],
    });
  });

  it('should return empty arrays when no messages are available', () => {
    expect(getChatArtifactSyncState([], undefined)).toEqual({
      displayedMessageIds: [],
      reloadedMessageIds: [],
    });
  });
});

describe('getChatStateAfterInitialMessage', () => {
  it('should preserve design system state after consuming the initial message', () => {
    expect(
      getChatStateAfterInitialMessage({
        designMd: '# Airbnb design system',
        designBrand: 'Airbnb',
        templateReference: {
          mode: 'inspired-by-template',
          templateId: 'template-1',
          title: 'Modern SaaS',
        },
      }),
    ).toEqual({
      designMd: '# Airbnb design system',
      designBrand: 'Airbnb',
      templateReference: {
        mode: 'inspired-by-template',
        templateId: 'template-1',
        title: 'Modern SaaS',
      },
    });
  });

  it('should preserve template reference even when no design system is present', () => {
    expect(
      getChatStateAfterInitialMessage({
        designBrand: 'Airbnb',
        templateReference: {
          mode: 'inspired-by-template',
          templateId: 'template-1',
        },
      }),
    ).toEqual({
      designMd: undefined,
      designBrand: 'Airbnb',
      templateReference: {
        mode: 'inspired-by-template',
        templateId: 'template-1',
      },
    });
  });

  it('should clear transient state when neither design system nor template reference is present', () => {
    expect(
      getChatStateAfterInitialMessage({
        designBrand: 'Airbnb',
      }),
    ).toBeNull();
  });
});
