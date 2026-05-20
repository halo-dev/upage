## ADDED Requirements

### Requirement: Choice request is persisted in message metadata
The system SHALL store the user choice request data in the assistant message's metadata field.

#### Scenario: Choice request saved with assistant message
- **WHEN** the Agent calls `requestUserChoice`
- **THEN** the system SHALL persist the choice request (question, options, mode, choiceId) in the message metadata as `choiceData.request`

### Requirement: Choice response is persisted in message metadata
The system SHALL store the user's choice response in the user message's metadata field.

#### Scenario: Choice response saved with user message
- **WHEN** the user submits a selection
- **THEN** the system SHALL persist the choice response (selected option IDs, custom text) in the user message metadata as `choiceData.response`

### Requirement: Choice data supports message history replay
The system SHALL ensure that choice data is loaded correctly when a chat history is retrieved.

#### Scenario: Chat history includes choice interactions
- **WHEN** a chat with choice interactions is loaded from the database
- **THEN** all assistant messages with choice requests SHALL have their `choiceData.request` intact
- **AND** all user messages with choice responses SHALL have their `choiceData.response` intact
- **AND** the frontend SHALL render the choice cards in their appropriate states (pending or completed)

### Requirement: Choice data supports chat rewind and fork
The system SHALL preserve choice data integrity when a chat is rewound or forked.

#### Scenario: Rewind to before a choice
- **WHEN** the user rewinds the chat to a message before a choice request
- **THEN** subsequent choice-related messages SHALL be marked as discarded
- **AND** the choice data in those discarded messages SHALL remain available for historical reference

#### Scenario: Fork at a choice message
- **WHEN** the user forks the chat at a message containing a choice
- **THEN** the new chat SHALL copy all messages including their choice data
- **AND** the forked choice interactions SHALL be independently editable

### Requirement: Choice data schema is versioned
The system SHALL include a version field in the choice data schema to support future evolution.

#### Scenario: Future schema changes
- **WHEN** the choice data schema evolves
- **THEN** the `choiceData` object SHALL contain a `version` field
- **AND** the system SHALL default to version `1` for all new choice data
