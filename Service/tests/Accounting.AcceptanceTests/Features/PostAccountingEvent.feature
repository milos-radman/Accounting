Feature: Post accounting event
    Other domains send accounting event messages. The accounting service applies the
    legal entity's booking rules and produces a balanced GLI journal.

Scenario: An Activation message produces a balanced journal
    Given a legal entity "ALS NLD" with open period "202410" and GLI serie 7414
    And the pseudo accounts
      | Code   | Description                  |
      | 140000 | Equipment Purchases          |
      | 192101 | Lease Rec - Curr Year Volume |
      | 192401 | Unearn Inc - Curr Year       |
    And an Activation rule set booking "Fixed Asset Value" credit to 140000 for accounting type "MG"
    And an Activation rule set booking "Total Plan Rent" debit to 192101
    And an Activation rule set booking "Total Plan Interest" credit to 192401
    When an Activation message arrives with accounting type "MG" and amounts
      | AmountType          | Amount   |
      | Fixed Asset Value   | 12500.00 |
      | Total Plan Rent     | 14640.00 |
      | Total Plan Interest | 2140.00  |
    Then a journal is created with GLI number 7414
    And the journal has 3 lines
    And the journal total debit is 14640.00 and total credit is 14640.00
    And the journal has no difference
    And a line books credit 12500.00 on account "140000"

Scenario: A redelivered message does not create a second journal
    Given a legal entity "ALS NLD" with open period "202410" and GLI serie 7414
    And the pseudo accounts
      | Code   | Description         |
      | 140000 | Equipment Purchases |
    And an Activation rule set booking "Fixed Asset Value" credit to 140000 for accounting type "MG"
    When an Activation message arrives with accounting type "MG" and amounts
      | AmountType        | Amount   |
      | Fixed Asset Value | 12500.00 |
    And the same message is delivered again
    Then the second delivery reports it was already processed
    And only one journal exists for the legal entity

Scenario: A message with a booking date in a closed period is rejected
    Given a legal entity "ALS NLD" with open period "202410" and GLI serie 7414
    And the pseudo accounts
      | Code   | Description         |
      | 140000 | Equipment Purchases |
    And an Activation rule set booking "Fixed Asset Value" credit to 140000 for accounting type "MG"
    When an Activation message arrives booked on "2024-09-15"
    Then the message is rejected with status 409
