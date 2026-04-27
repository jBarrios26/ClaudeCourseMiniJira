# Backlog — Mini Jira MVP

**Version:** 1.0
**Date:** 2026-04-20
**Format:** BDD Gherkin

---

## US-01 — Authentication

```gherkin
Feature: User Authentication
  As a team member
  I want to log in with my credentials
  So that I can access the ticket system securely

  Scenario: Successful login
    Given I am a registered user with valid credentials
    When I submit my username and password
    Then I receive a JWT access token and a refresh token
    And I am redirected to the active ticket board

  Scenario: Failed login with wrong password
    Given I am a registered user
    When I submit an incorrect password
    Then I see an error message "Invalid credentials"
    And no token is issued

  Scenario: Accessing a protected route without a session
    Given I am not logged in
    When I navigate to any application route
    Then I am redirected to the login page
```

---

## US-02 — Ticket Creation

```gherkin
Feature: Ticket Creation
  As an authenticated user
  I want to create a new ticket
  So that work items are tracked by the team

  Scenario: Successfully creating a ticket with required fields
    Given I am logged in as any authenticated user
    When I submit a new ticket with a title of 60 characters, status "To Do", and priority "Medium"
    Then the ticket is saved with my user set as "Created by"
    And "Created at" and "Updated at" timestamps are recorded automatically

  Scenario: Creating a ticket with all optional fields
    Given I am logged in as any authenticated user
    When I submit a ticket including a markdown description, assignee, and two labels
    Then all fields are persisted and visible on the ticket detail view

  Scenario: Attempting to create a ticket with a title exceeding 120 characters
    Given I am logged in as any authenticated user
    When I submit a ticket title with 121 characters
    Then the form shows a validation error "Title must be 120 characters or fewer"
    And no ticket is created
```

---

## US-03 — Concurrent Edit Conflict (Optimistic Locking)

```gherkin
Feature: Concurrent Ticket Edit Protection
  As a team member
  I want to be warned when another user has edited a ticket I am working on
  So that I do not accidentally overwrite their changes

  Scenario: Saving a ticket that was updated by another user in the meantime
    Given User A and User B both open ticket #42 at the same version
    When User B saves a change first, incrementing the version
    And User A attempts to save their own changes with the stale version
    Then the API returns HTTP 409
    And User A sees a non-dismissible warning:
      "This ticket was updated by [User B] while you were editing. Review their changes before saving."

  Scenario: Saving a ticket with no concurrent modification
    Given I open ticket #42 and the version has not changed since I loaded it
    When I submit my changes
    Then the ticket is saved successfully
    And the version integer is incremented by 1
```

---

## EC-01 — Session Expires Mid-Edit (Edge Case)

```gherkin
Feature: Draft Preservation on Session Expiry
  As an authenticated user editing a ticket
  I want my draft to be preserved if my session expires before I save
  So that I do not lose my work when redirected to login

  Scenario: Access token expires and refresh token is also expired
    Given I have been editing ticket #42 for an extended period
    And my JWT access token has expired
    And my refresh token has also expired
    When I attempt to save my changes
    Then the app detects the 401 response from the API
    And my unsaved draft is persisted to localStorage before any redirect
    And I am redirected to the login page
    And after logging in I see a banner: "You have an unsaved draft for ticket #42. Resume editing?"

  Scenario: Access token expires but refresh token is still valid
    Given I am editing ticket #42
    And my JWT access token has expired
    And my refresh token is still valid
    When I attempt to save my changes
    Then the app silently exchanges the refresh token for a new access token
    And the save is retried automatically
    And I see no interruption or error
```

---

## EC-02 — Same User Edits Ticket in Two Tabs (Edge Case)

```gherkin
Feature: Same-User Tab Conflict on Ticket Edit
  As an authenticated user
  I want a clear message when I conflict with my own edits from another tab
  So that I am not confused by seeing my own name in a conflict warning

  Scenario: User saves a ticket in Tab 1 then attempts to save the same ticket in Tab 2
    Given I have ticket #42 open in Tab 1 and Tab 2, both at version 3
    When I save my changes in Tab 1, incrementing the version to 4
    And I attempt to save different changes in Tab 2, which still holds version 3
    Then the API returns HTTP 409
    And I see a non-dismissible warning:
      "You saved this ticket in another tab. Reload to see the latest version before saving."
    And I am not shown the generic multi-user conflict message

  Scenario: User reloads Tab 2 after a same-user tab conflict
    Given I have been shown the same-user tab conflict warning in Tab 2
    When I choose to reload the ticket
    Then the ticket reloads at the latest version
    And my draft changes in Tab 2 are discarded
    And no conflict warning is shown
```
