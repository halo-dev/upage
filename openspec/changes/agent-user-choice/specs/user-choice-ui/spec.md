## ADDED Requirements

### Requirement: Client renders user choice card in chat
The system SHALL render an interactive choice card within the assistant message area when a `data-user-choice` part is received.

#### Scenario: Choice card appears in streaming message
- **WHEN** the client receives a `data-user-choice` part with status `pending`
- **THEN** the client SHALL render a `UserChoiceCard` component within the current assistant message
- **AND** the card SHALL display the question text and all provided options

### Requirement: Choice card supports single selection
The system SHALL provide a radio-button-style interface for single-choice mode.

#### Scenario: User selects one option
- **WHEN** the choice mode is `single`
- **THEN** the client SHALL render each option as a selectable card with a radio indicator
- **AND** selecting one option SHALL deselect any previously selected option
- **AND** the user SHALL confirm the selection by clicking a submit button or pressing Enter

### Requirement: Choice card supports multiple selection
The system SHALL provide a checkbox-style interface for multiple-choice mode.

#### Scenario: User selects multiple options
- **WHEN** the choice mode is `multiple`
- **THEN** the client SHALL render each option as a selectable card with a checkbox indicator
- **AND** selecting one option SHALL not affect other selections
- **AND** the user SHALL confirm selections by clicking a submit button or pressing Enter

### Requirement: Choice card supports custom text input
The system SHALL provide a text input field when `allowCustomInput` is enabled.

#### Scenario: User types custom input
- **WHEN** `allowCustomInput` is `true`
- **THEN** the client SHALL render a text input field below the predefined options
- **AND** the user SHALL be able to type custom text and submit it
- **AND** the user SHALL be able to combine custom input with selected options (in hybrid mode)

### Requirement: Chat input is disabled while awaiting user choice
The system SHALL prevent the user from sending new chat messages while a choice is pending.

#### Scenario: Input disabled during pending choice
- **WHEN** a choice request with status `pending` is active
- **THEN** the chat textarea SHALL be visually disabled (e.g., opacity reduced, placeholder changed)
- **AND** the send button SHALL be disabled
- **AND** pressing Enter in the textarea SHALL not send a message

### Requirement: User selection is sent as a user message
The system SHALL transmit the user's selection as a new user message in the chat.

#### Scenario: Selection submitted as message
- **WHEN** the user confirms their selection
- **THEN** the client SHALL call `sendMessage` with the selection result
- **AND** the message text SHALL contain a human-readable summary of the selection
- **AND** the message metadata SHALL contain the structured choice response

### Requirement: Choice card shows completed state after selection
The system SHALL update the choice card to show a "completed" state after the user has made a selection.

#### Scenario: Completed choice card rendering
- **WHEN** the user's selection message appears in the chat history
- **THEN** the original choice card SHALL display the selected options (or custom input) in a read-only, completed state
- **AND** the card SHALL indicate that the choice has been submitted
