-- Accounting App migration 004: close the rollback window and remove the JSON snapshot.
SET XACT_ABORT ON;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE MigrationId = '003-unprefixed-tables')
  THROW 51020, 'Migration 003 must be applied first.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.StoreMetadata WHERE StoreKey=N'app' AND InitializedAt IS NOT NULL)
  THROW 51021, 'The relational store is not initialized; keep the snapshot until app data is saved.', 1;
DECLARE @stateResult table (StateJson nvarchar(max));
INSERT @stateResult EXEC dbo.GetDemoState;
DECLARE @stateJson nvarchar(max) = (SELECT TOP (1) StateJson FROM @stateResult);
IF (SELECT COUNT(*) FROM @stateResult) <> 1 OR @stateJson IS NULL OR ISJSON(@stateJson) <> 1
  THROW 51022, 'The relational state could not be read; the rollback snapshot was retained.', 1;
DECLARE @requiredCollections table (CollectionName nvarchar(60) NOT NULL PRIMARY KEY);
INSERT @requiredCollections (CollectionName) VALUES
  (N'currencies'),
  (N'parties'),
  (N'organizationUnits'),
  (N'legalEntities'),
  (N'accountingClasses'),
  (N'legalAccountingClasses'),
  (N'ledgers'),
  (N'legalAccountingLedgers'),
  (N'amountTypes'),
  (N'conditionValues'),
  (N'conditionValueOptions'),
  (N'eventCategories'),
  (N'accountingEvents'),
  (N'formulas'),
  (N'formulaConditions'),
  (N'conditions'),
  (N'accountingRules'),
  (N'pseudoAccounts'),
  (N'chartOfAccounts'),
  (N'coaNodes'),
  (N'extAccountValues'),
  (N'extAccountParts'),
  (N'journals'),
  (N'integrations'),
  (N'pseudoAccountCoaLinks'),
  (N'entityCoaNodes'),
  (N'pseudoAccountExtParts'),
  (N'accrualCodes'),
  (N'accrualItems'),
  (N'accrualScheduleLines'),
  (N'pendingMessages'),
  (N'revalueAccounts'),
  (N'revalueTransactions'),
  (N'exportBatches'),
  (N'ledgerSeries'),
  (N'journalEvents'),
  (N'recognitionCategories'),
  (N'recognitionPlans'),
  (N'recognitionStates'),
  (N'openingBalances');
IF EXISTS (SELECT 1 FROM @requiredCollections WHERE COALESCE(LEFT(LTRIM(JSON_QUERY(@stateJson, N'$.' + CollectionName)), 1), N'') <> N'[')
  THROW 51023, 'The relational state is missing an AppData collection; the snapshot was retained.', 1;
GO
CREATE OR ALTER PROCEDURE dbo.SaveDemoState @StateJson nvarchar(max)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  IF ISJSON(@StateJson) <> 1 OR LEFT(LTRIM(@StateJson), 1) <> N'{'
    THROW 51000, 'Demo state must be a JSON object.', 1;

  DECLARE @requiredCollections table (JsonPath nvarchar(100) NOT NULL);
  INSERT @requiredCollections (JsonPath) VALUES
    ('$.currencies'), ('$.parties'), ('$.organizationUnits'), ('$.legalEntities'),
    ('$.accountingClasses'), ('$.legalAccountingClasses'), ('$.ledgers'), ('$.legalAccountingLedgers'),
    ('$.amountTypes'), ('$.conditionValues'), ('$.conditionValueOptions'), ('$.eventCategories'),
    ('$.accountingEvents'), ('$.formulas'), ('$.formulaConditions'), ('$.conditions'),
    ('$.accountingRules'), ('$.pseudoAccounts'), ('$.chartOfAccounts'), ('$.coaNodes'),
    ('$.extAccountValues'), ('$.extAccountParts'), ('$.journals'), ('$.integrations'),
    ('$.pseudoAccountCoaLinks'), ('$.entityCoaNodes'), ('$.pseudoAccountExtParts'), ('$.accrualCodes'),
    ('$.accrualItems'), ('$.accrualScheduleLines'), ('$.pendingMessages'), ('$.revalueAccounts'),
    ('$.revalueTransactions'), ('$.exportBatches'), ('$.ledgerSeries'), ('$.journalEvents'),
    ('$.recognitionCategories'), ('$.recognitionPlans'), ('$.recognitionStates'), ('$.openingBalances');
  IF EXISTS (SELECT 1 FROM @requiredCollections
    WHERE COALESCE(LEFT(LTRIM(JSON_QUERY(@StateJson, JsonPath)), 1), N'') <> N'[')
    THROW 51001, 'Demo state must include all 40 AppData collections as arrays.', 1;

  BEGIN TRANSACTION;
  DELETE dbo.JournalLine;
  DELETE dbo.JournalEventAgreementLine;
  DELETE dbo.JournalEventInvoice;
  DELETE dbo.JournalEventReference;
  DELETE dbo.PendingMessageConditionInput;
  DELETE dbo.PendingMessageAmount;
  DELETE dbo.PendingMessageAccountValue;
  DELETE dbo.AccrualConditionInput;
  DELETE dbo.AccrualAccountValue;
  DELETE dbo.AccrualScheduleLine;
  DELETE dbo.RecognitionSchedule;
  DELETE dbo.ImportedRecognitionSchedule;
  DELETE dbo.RecognitionPlanLine;
  DELETE dbo.IntegrationDefaultKeepPart;
  DELETE dbo.PseudoAccountSummaryKeepPart;
  DELETE dbo.FormulaAppliesToEvent;
  DELETE dbo.ExportBatchJournal;
  DELETE dbo.ExportBatchLine;
  DELETE dbo.LegalEntityPartySnapshot;
  DELETE dbo.PseudoAccountExtPart;
  DELETE dbo.PseudoAccountCoaLink;
  DELETE dbo.RevalueTransaction;
  DELETE dbo.RevalueAccount;
  DELETE dbo.RecognitionState;
  DELETE dbo.ExportBatch;
  DELETE dbo.RecognitionPlan;
  DELETE dbo.RecognitionCategory;
  DELETE dbo.AccrualItem;
  DELETE dbo.PendingMessage;
  DELETE dbo.JournalPostedEvent;
  DELETE dbo.Journal;
  DELETE dbo.AccrualCode;
  DELETE dbo.LedgerSeries;
  DELETE dbo.Integration;
  DELETE dbo.EntityCoaNode;
  DELETE dbo.ExtAccountPart;
  DELETE dbo.ExtAccountValue;
  DELETE dbo.PseudoAccount;
  DELETE dbo.AccountingRule;
  DELETE dbo.Condition;
  DELETE dbo.FormulaCondition;
  DELETE dbo.Formula;
  DELETE dbo.AccountingEvent;
  DELETE dbo.EventCategory;
  DELETE dbo.ConditionValueOption;
  DELETE dbo.ConditionValue;
  DELETE dbo.AmountType;
  DELETE dbo.LegalAccountingLedger;
  DELETE dbo.LegalAccountingClass;
  DELETE dbo.LegalEntity;
  DELETE dbo.OrganizationUnit;
  DELETE dbo.Party;
  DELETE dbo.Currency;
  DELETE dbo.AccountingClass;
  DELETE dbo.Ledger;
  DELETE dbo.CoaNode;
  DELETE dbo.ChartOfAccount;
  DELETE dbo.OpeningBalance;

  INSERT dbo.Currency (Id, Code, Name, Rate, AsOf)
  SELECT Id, Code, Name, Rate, AsOf FROM OPENJSON(@StateJson, '$.currencies') WITH (
    Id int '$.id', Code nvarchar(20) '$.code', Name nvarchar(200) '$.name',
    Rate decimal(28,12) '$.rate', AsOf date '$.asOf');
  INSERT dbo.Party (Id, Kind, Name, FullName, OrgNumber, Address1, Address2, Zip, City, CountyState, Country, TaxCountry, Phone, Email)
  SELECT Id, Kind, Name, FullName, OrgNumber, Address1, Address2, Zip, City, CountyState, Country, TaxCountry, Phone, Email
  FROM OPENJSON(@StateJson, '$.parties') WITH (
    Id int '$.id', Kind nvarchar(30) '$.kind', Name nvarchar(200) '$.name', FullName nvarchar(500) '$.fullName',
    OrgNumber nvarchar(100) '$.orgNumber', Address1 nvarchar(500) '$.address1', Address2 nvarchar(500) '$.address2',
    Zip nvarchar(40) '$.zip', City nvarchar(200) '$.city', CountyState nvarchar(200) '$.countyState',
    Country nvarchar(100) '$.country', TaxCountry nvarchar(100) '$.taxCountry', Phone nvarchar(100) '$.phone', Email nvarchar(320) '$.email');
  INSERT dbo.OrganizationUnit (Id, PartyId, LegalEntityId)
  SELECT Id, PartyId, LegalEntityId FROM OPENJSON(@StateJson, '$.organizationUnits') WITH (
    Id int '$.id', PartyId int '$.partyId', LegalEntityId int '$.legalEntityId');
  INSERT dbo.AccountingClass (Id, Code, Name, Description)
  SELECT Id, Code, Name, Description FROM OPENJSON(@StateJson, '$.accountingClasses') WITH (
    Id int '$.id', Code nvarchar(100) '$.code', Name nvarchar(200) '$.name', Description nvarchar(1000) '$.description');
  INSERT dbo.Ledger (Id, Code, Name, Description)
  SELECT Id, Code, Name, Description FROM OPENJSON(@StateJson, '$.ledgers') WITH (
    Id int '$.id', Code nvarchar(100) '$.code', Name nvarchar(200) '$.name', Description nvarchar(1000) '$.description');
  INSERT dbo.AmountType (Id, Name, Description, AmountGroup, AllowsMultipleCodes, System)
  SELECT Id, Name, Description, AmountGroup, AllowsMultipleCodes, System FROM OPENJSON(@StateJson, '$.amountTypes') WITH (
    Id int '$.id', Name nvarchar(200) '$.name', Description nvarchar(1000) '$.description', AmountGroup nvarchar(30) '$.amountGroup',
    AllowsMultipleCodes bit '$.allowsMultipleCodes', System bit '$.system');
  INSERT dbo.ConditionValue (Id, Name)
  SELECT Id, Name FROM OPENJSON(@StateJson, '$.conditionValues') WITH (Id int '$.id', Name nvarchar(200) '$.name');
  INSERT dbo.ConditionValueOption (Id, ConditionValueId, Code, Description)
  SELECT Id, ConditionValueId, Code, Description FROM OPENJSON(@StateJson, '$.conditionValueOptions') WITH (
    Id int '$.id', ConditionValueId int '$.conditionValueId', Code nvarchar(200) '$.code', Description nvarchar(1000) '$.description');
  INSERT dbo.EventCategory (Id, Name, Description)
  SELECT Id, Name, Description FROM OPENJSON(@StateJson, '$.eventCategories') WITH (
    Id int '$.id', Name nvarchar(200) '$.name', Description nvarchar(1000) '$.description');
  INSERT dbo.AccountingEvent (Id, Name, Description, Code, BookingDate, EventCategoryId, OriginalEventId, PostingMode, ReverseMatchBy, UsesAccountingRules)
  SELECT Id, Name, Description, Code, BookingDate, EventCategoryId, OriginalEventId, PostingMode, ReverseMatchBy, UsesAccountingRules
  FROM OPENJSON(@StateJson, '$.accountingEvents') WITH (
    Id int '$.id', Name nvarchar(300) '$.name', Description nvarchar(1000) '$.description', Code nvarchar(100) '$.code',
    BookingDate int '$.bookingDate', EventCategoryId int '$.eventCategoryId', OriginalEventId int '$.originalEventId',
    PostingMode nvarchar(30) '$.postingMode', ReverseMatchBy nvarchar(50) '$.reverseMatchBy', UsesAccountingRules bit '$.usesAccountingRules');
  INSERT dbo.Formula (RowOrdinal, Id, Name, Description, AmountTypeId, DebitAccount, CreditAccount, FormulaConditionId, Category, ExcludeFromRevaluation, ReverseMonthly)
  SELECT CONVERT(int, f.[key]), v.Id, v.Name, v.Description, v.AmountTypeId, v.DebitAccount, v.CreditAccount,
    v.FormulaConditionId, v.Category, v.ExcludeFromRevaluation, v.ReverseMonthly
  FROM OPENJSON(@StateJson, '$.formulas') f
  CROSS APPLY OPENJSON(f.value) WITH (
    Id int '$.id', Name nvarchar(300) '$.name', Description nvarchar(2000) '$.description', AmountTypeId int '$.amountTypeId',
    DebitAccount nvarchar(100) '$.debitAccount', CreditAccount nvarchar(100) '$.creditAccount', FormulaConditionId int '$.formulaConditionId',
    Category nvarchar(200) '$.category',
    ExcludeFromRevaluation bit '$.excludeFromRevaluation', ReverseMonthly bit '$.reverseMonthly') v;
  INSERT dbo.FormulaAppliesToEvent (FormulaOrdinal, EventId, Ordinal)
  SELECT CONVERT(int, f.[key]), TRY_CONVERT(int, a.[value]), CONVERT(int, a.[key])
  FROM OPENJSON(@StateJson, '$.formulas') f
  CROSS APPLY OPENJSON(f.value, '$.appliesToEvents') a;
  INSERT dbo.FormulaCondition (Id, Name)
  SELECT Id, Name FROM OPENJSON(@StateJson, '$.formulaConditions') WITH (Id int '$.id', Name nvarchar(300) '$.name');
  INSERT dbo.Condition (Id, FormulaConditionId, Level, ConditionValueId, Value, DebitPseudoAccountId, CreditPseudoAccountId, Operator)
  SELECT Id, FormulaConditionId, Level, ConditionValueId, Value, DebitPseudoAccountId, CreditPseudoAccountId, Operator
  FROM OPENJSON(@StateJson, '$.conditions') WITH (
    Id int '$.id', FormulaConditionId int '$.formulaConditionId', Level int '$.level', ConditionValueId int '$.conditionValueId',
    Value nvarchar(1000) '$.value', DebitPseudoAccountId int '$.debitPseudoAccountId',
    CreditPseudoAccountId int '$.creditPseudoAccountId', Operator nvarchar(20) '$.operator');
  INSERT dbo.ChartOfAccount (Id, Name, Description)
  SELECT Id, Name, Description FROM OPENJSON(@StateJson, '$.chartOfAccounts') WITH (
    Id int '$.id', Name nvarchar(200) '$.name', Description nvarchar(1000) '$.description');
  INSERT dbo.CoaNode (Id, CoaId, Name, Description, [Order], Depth, ParentId, AccountFrom, AccountTo)
  SELECT Id, CoaId, Name, Description, [Order], Depth, ParentId, AccountFrom, AccountTo
  FROM OPENJSON(@StateJson, '$.coaNodes') WITH (
    Id int '$.id', CoaId int '$.coaId', Name nvarchar(200) '$.name', Description nvarchar(1000) '$.description',
    [Order] nvarchar(100) '$.order', Depth int '$.depth', ParentId int '$.parentId',
    AccountFrom int '$.accountFrom', AccountTo int '$.accountTo');

  INSERT dbo.LegalEntity (Id, Name, Description, OwnerPartyId, OwnerCode, BaseCurrencyId, Revaluation,
    RevaluationResultAccount, ExchangeDifferenceAccount, GliNumberSerie, GliPrefix, CoaId, Responsible,
    ResponsiblePartyId, ControllerPartyId, FiscalYearStartMonth, EndOfMonth, ClosedPeriod, GlInterfaceDate,
    OpenPeriod, JournalDifferences, NextGli, DimensionSeparator, ShowInTabs)
  SELECT Id, Name, Description, OwnerPartyId, OwnerCode, BaseCurrencyId, Revaluation, RevaluationResultAccount,
    ExchangeDifferenceAccount, GliNumberSerie, GliPrefix, CoaId, Responsible, ResponsiblePartyId, ControllerPartyId,
    FiscalYearStartMonth, EndOfMonth, ClosedPeriod, GlInterfaceDate, OpenPeriod, JournalDifferences, NextGli,
    DimensionSeparator, ShowInTabs
  FROM OPENJSON(@StateJson, '$.legalEntities') WITH (
    Id int '$.id', Name nvarchar(300) '$.name', Description nvarchar(1000) '$.description',
    OwnerPartyId int '$.ownerPartyId', OwnerCode nvarchar(100) '$.ownerCode', BaseCurrencyId int '$.baseCurrencyId',
    Revaluation bit '$.revaluation', RevaluationResultAccount nvarchar(100) '$.revaluationResultAccount',
    ExchangeDifferenceAccount nvarchar(100) '$.exchangeDifferenceAccount', GliNumberSerie int '$.gliNumberSerie',
    GliPrefix nvarchar(100) '$.gliPrefix', CoaId int '$.coaId', Responsible nvarchar(300) '$.responsible',
    ResponsiblePartyId int '$.responsiblePartyId', ControllerPartyId int '$.controllerPartyId',
    FiscalYearStartMonth int '$.fiscalYearStartMonth', EndOfMonth char(6) '$.endOfMonth',
    ClosedPeriod char(6) '$.closedPeriod', GlInterfaceDate date '$.glInterfaceDate', OpenPeriod char(6) '$.openPeriod',
    JournalDifferences int '$.journalDifferences', NextGli int '$.nextGli', DimensionSeparator nvarchar(20) '$.dimensionSeparator',
    ShowInTabs bit '$.showInTabs');
  INSERT dbo.LegalEntityPartySnapshot (LegalEntityId, Role, PartyId, Kind, Name, FullName, Reference, Address, City, Country, Email, Phone, AsOf)
  SELECT e.Id, r.Role, p.PartyId, p.Kind, p.Name, p.FullName, p.Reference, p.Address, p.City, p.Country, p.Email, p.Phone, p.AsOf
  FROM OPENJSON(@StateJson, '$.legalEntities') WITH (
    Id int '$.id', Owner nvarchar(max) '$.owner' AS JSON,
    ResponsibleRef nvarchar(max) '$.responsibleRef' AS JSON, ControllerRef nvarchar(max) '$.controllerRef' AS JSON) e
  CROSS APPLY (VALUES (N'Owner', e.Owner), (N'Responsible', e.ResponsibleRef), (N'Controller', e.ControllerRef)) r(Role, JsonValue)
  CROSS APPLY OPENJSON(r.JsonValue) WITH (
    PartyId int '$.partyId', Kind nvarchar(30) '$.kind', Name nvarchar(200) '$.name', FullName nvarchar(500) '$.fullName',
    Reference nvarchar(100) '$.reference', Address nvarchar(1000) '$.address', City nvarchar(200) '$.city',
    Country nvarchar(100) '$.country', Email nvarchar(320) '$.email', Phone nvarchar(100) '$.phone', AsOf date '$.asOf') p;
  INSERT dbo.LegalAccountingClass (Id, LegalEntityId, AccountingClassId)
  SELECT Id, LegalEntityId, AccountingClassId FROM OPENJSON(@StateJson, '$.legalAccountingClasses') WITH (
    Id int '$.id', LegalEntityId int '$.legalEntityId', AccountingClassId int '$.accountingClassId');
  INSERT dbo.LegalAccountingLedger (Id, LegalAccountingClassId, LedgerId)
  SELECT Id, LegalAccountingClassId, LedgerId FROM OPENJSON(@StateJson, '$.legalAccountingLedgers') WITH (
    Id int '$.id', LegalAccountingClassId int '$.legalAccountingClassId', LedgerId int '$.ledgerId');
  INSERT dbo.AccountingRule (Id, EntityCode, LegalAccountingLedgerId, AccountingEventId, FormulaId, DebitCredit)
  SELECT Id, EntityCode, LegalAccountingLedgerId, AccountingEventId, FormulaId, DebitCredit
  FROM OPENJSON(@StateJson, '$.accountingRules') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', LegalAccountingLedgerId int '$.legalAccountingLedgerId',
    AccountingEventId int '$.accountingEventId', FormulaId int '$.formulaId', DebitCredit char(1) '$.debitCredit');
  INSERT dbo.PseudoAccount (EntityCode, Id, Pseudo, Description, ExtPseudo, ExtDescription, Revaluation, AccountKind, SummarizeToGl)
  SELECT EntityCode, Id, Pseudo, Description, ExtPseudo, ExtDescription, Revaluation, AccountKind, SummarizeToGl
  FROM OPENJSON(@StateJson, '$.pseudoAccounts') WITH (
    EntityCode nvarchar(100) '$.entityCode', Id int '$.id', Pseudo nvarchar(100) '$.pseudo',
    Description nvarchar(1000) '$.description', ExtPseudo nvarchar(100) '$.extPseudo',
    ExtDescription nvarchar(1000) '$.extDescription', Revaluation bit '$.revaluation',
    AccountKind nvarchar(30) '$.accountKind', SummarizeToGl bit '$.summarizeToGl',
    SummaryKeepPartIds nvarchar(max) '$.summaryKeepPartIds' AS JSON) p;
  INSERT dbo.PseudoAccountSummaryKeepPart (EntityCode, PseudoAccountId, ExtAccountPartId, Ordinal)
  SELECT p.EntityCode, p.Id, TRY_CONVERT(int, v.[value]), CONVERT(int, v.[key])
  FROM OPENJSON(@StateJson, '$.pseudoAccounts') WITH (
    EntityCode nvarchar(100) '$.entityCode', Id int '$.id',
    SummaryKeepPartIds nvarchar(max) '$.summaryKeepPartIds' AS JSON) p
  CROSS APPLY OPENJSON(p.SummaryKeepPartIds) v;
  INSERT dbo.PseudoAccountExtPart (Id, EntityCode, PseudoAccountId, ExtAccountPartId, InUse)
  SELECT Id, EntityCode, PseudoAccountId, ExtAccountPartId, InUse
  FROM OPENJSON(@StateJson, '$.pseudoAccountExtParts') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', PseudoAccountId int '$.pseudoAccountId',
    ExtAccountPartId int '$.extAccountPartId', InUse bit '$.inUse');
  INSERT dbo.PseudoAccountCoaLink (Id, EntityCode, PseudoAccountId, CoaNodeId)
  SELECT Id, EntityCode, PseudoAccountId, CoaNodeId FROM OPENJSON(@StateJson, '$.pseudoAccountCoaLinks') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', PseudoAccountId int '$.pseudoAccountId', CoaNodeId int '$.coaNodeId');
  INSERT dbo.ExtAccountValue (Id, Name, Level, DataType, Source, MessageField)
  SELECT Id, Name, Level, DataType, Source, MessageField FROM OPENJSON(@StateJson, '$.extAccountValues') WITH (
    Id int '$.id', Name nvarchar(200) '$.name', Level nvarchar(100) '$.level', DataType nvarchar(30) '$.dataType',
    Source nvarchar(40) '$.source', MessageField nvarchar(200) '$.messageField');
  INSERT dbo.ExtAccountPart (Id, LegalEntityId, ExtAccountValueId, PartNumber, Name, Length, Required)
  SELECT Id, LegalEntityId, ExtAccountValueId, PartNumber, Name, Length, Required
  FROM OPENJSON(@StateJson, '$.extAccountParts') WITH (
    Id int '$.id', LegalEntityId int '$.legalEntityId', ExtAccountValueId int '$.extAccountValueId',
    PartNumber int '$.partNumber', Name nvarchar(200) '$.name', Length int '$.length', Required bit '$.required');
  INSERT dbo.EntityCoaNode (Id, LegalEntityId, Name, Description, [Order], Depth, ParentId, AccountFrom, AccountTo)
  SELECT Id, LegalEntityId, Name, Description, [Order], Depth, ParentId, AccountFrom, AccountTo
  FROM OPENJSON(@StateJson, '$.entityCoaNodes') WITH (
    Id int '$.id', LegalEntityId int '$.legalEntityId', Name nvarchar(200) '$.name', Description nvarchar(1000) '$.description',
    [Order] nvarchar(100) '$.order', Depth int '$.depth', ParentId int '$.parentId',
    AccountFrom int '$.accountFrom', AccountTo int '$.accountTo');
  INSERT dbo.Integration (Id, LegalEntityId, Name, Description, FileName, FileNamePattern, FileLocation, ArchiveLocation,
    Status, ExecutionType, NextSequence, LastExecution, LastExecutionBy, Records, TargetGl, Format, Transport, Ledger, Summarization)
  SELECT Id, LegalEntityId, Name, Description, FileName, FileNamePattern, FileLocation, ArchiveLocation,
    Status, ExecutionType, NextSequence, LastExecution, LastExecutionBy, Records, TargetGl, Format, Transport, Ledger, Summarization
  FROM OPENJSON(@StateJson, '$.integrations') WITH (
    Id int '$.id', LegalEntityId int '$.legalEntityId', Name nvarchar(300) '$.name', Description nvarchar(1000) '$.description',
    FileName nvarchar(300) '$.fileName', FileNamePattern nvarchar(1000) '$.fileNamePattern',
    FileLocation nvarchar(2000) '$.fileLocation', ArchiveLocation nvarchar(2000) '$.archiveLocation',
    Status nvarchar(50) '$.status', ExecutionType nvarchar(50) '$.executionType', NextSequence int '$.nextSequence',
    LastExecution nvarchar(100) '$.lastExecution', LastExecutionBy nvarchar(200) '$.lastExecutionBy', Records int '$.records',
    TargetGl nvarchar(100) '$.targetGl', Format nvarchar(30) '$.format', Transport nvarchar(30) '$.transport',
    Ledger nvarchar(100) '$.ledger', Summarization nvarchar(30) '$.summarization',
    DefaultKeepPartIds nvarchar(max) '$.defaultKeepPartIds' AS JSON) i;
  INSERT dbo.IntegrationDefaultKeepPart (IntegrationId, ExtAccountPartId, Ordinal)
  SELECT i.Id, TRY_CONVERT(int, v.[value]), CONVERT(int, v.[key])
  FROM OPENJSON(@StateJson, '$.integrations') WITH (
    Id int '$.id', DefaultKeepPartIds nvarchar(max) '$.defaultKeepPartIds' AS JSON) i
  CROSS APPLY OPENJSON(i.DefaultKeepPartIds) v;
  INSERT dbo.LedgerSeries (Id, LegalEntityId, Ledger, Prefix, NextNumber)
  SELECT Id, LegalEntityId, Ledger, Prefix, NextNumber FROM OPENJSON(@StateJson, '$.ledgerSeries') WITH (
    Id int '$.id', LegalEntityId int '$.legalEntityId', Ledger nvarchar(100) '$.ledger',
    Prefix nvarchar(100) '$.prefix', NextNumber int '$.nextNumber');
  INSERT dbo.AccrualCode (Id, EntityCode, Code, Name, Direction, Months, DeferralAccount, CounterAccount,
    RecognitionAccount, RecognitionFormulaId, TriggerAmountTypeId)
  SELECT Id, EntityCode, Code, Name, Direction, Months, DeferralAccount, CounterAccount,
    RecognitionAccount, RecognitionFormulaId, TriggerAmountTypeId
  FROM OPENJSON(@StateJson, '$.accrualCodes') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', Code nvarchar(100) '$.code', Name nvarchar(300) '$.name',
    Direction nvarchar(20) '$.direction', Months int '$.months', DeferralAccount nvarchar(100) '$.deferralAccount',
    CounterAccount nvarchar(100) '$.counterAccount', RecognitionAccount nvarchar(100) '$.recognitionAccount',
    RecognitionFormulaId int '$.recognitionFormulaId', TriggerAmountTypeId int '$.triggerAmountTypeId');
  INSERT dbo.RecognitionCategory (Id, EntityCode, Name, Kind, InvoicedAmountType, AccruedAmountType,
    DeferredAmountType, IncomeAmountType, DebitAmountType, CreditAmountType)
  SELECT Id, EntityCode, Name, Kind, InvoicedAmountType, AccruedAmountType, DeferredAmountType,
    IncomeAmountType, DebitAmountType, CreditAmountType
  FROM OPENJSON(@StateJson, '$.recognitionCategories') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', Name nvarchar(200) '$.name', Kind nvarchar(30) '$.kind',
    InvoicedAmountType nvarchar(100) '$.invoicedAmountType', AccruedAmountType nvarchar(100) '$.accruedAmountType',
    DeferredAmountType nvarchar(100) '$.deferredAmountType', IncomeAmountType nvarchar(100) '$.incomeAmountType',
    DebitAmountType nvarchar(100) '$.debitAmountType', CreditAmountType nvarchar(100) '$.creditAmountType');
  INSERT dbo.Journal (LegalEntityId, GliNumber, Ordinal, GliPrefix, AccountingEvent, LineCount, BookingDate,
    CreateDate, ExportDate, ExportVoucher, Difference, CreatedBy, Manual, ReversesGli, BroughtForward)
  SELECT j.LegalEntityId, j.GliNumber, CONVERT(int, raw.[key]), j.GliPrefix, j.AccountingEvent, j.LineCount,
    j.BookingDate, j.CreateDate, j.ExportDate, j.ExportVoucher, j.Difference, j.CreatedBy, j.Manual, j.ReversesGli, j.BroughtForward
  FROM OPENJSON(@StateJson, '$.journals') raw
  CROSS APPLY OPENJSON(raw.[value]) WITH (
    LegalEntityId int '$.legalEntityId', GliNumber int '$.gliNumber', GliPrefix nvarchar(100) '$.gliPrefix',
    AccountingEvent nvarchar(300) '$.accountingEvent', LineCount int '$.lineCount', BookingDate date '$.bookingDate',
    CreateDate nvarchar(50) '$.createDate', ExportDate date '$.exportDate', ExportVoucher nvarchar(100) '$.exportVoucher',
    Difference bit '$.difference', CreatedBy nvarchar(200) '$.createdBy', Manual bit '$.manual',
    ReversesGli int '$.reversesGli', BroughtForward bit '$.broughtForward') j;
  INSERT dbo.JournalLine (LegalEntityId, GliNumber, Line, PseudoAccount, Description, Agreement, AgreementLine,
    Period, InvoicingPeriod, Customer, Supplier, Invoice, RefNo, PaymentId, Debit, Credit, Ledger, Currency,
    CurrencyRate, Reversed, ReversesLine, Formula, ExternalAccountString, AmountType, AmountCode, ConditionValue)
  SELECT j.LegalEntityId, j.GliNumber, l.Line, l.PseudoAccount, l.Description, l.Agreement, l.AgreementLine,
    l.Period, l.InvoicingPeriod, l.Customer, l.Supplier, l.Invoice, l.RefNo, l.PaymentId, l.Debit, l.Credit,
    l.Ledger, l.Currency, l.CurrencyRate, l.Reversed, l.ReversesLine, l.Formula, l.ExternalAccountString, l.AmountType,
    l.AmountCode, l.ConditionValue
  FROM OPENJSON(@StateJson, '$.journals') WITH (
    LegalEntityId int '$.legalEntityId', GliNumber int '$.gliNumber', Lines nvarchar(max) '$.lines' AS JSON) j
  CROSS APPLY OPENJSON(j.Lines) WITH (
    Line int '$.line', PseudoAccount nvarchar(100) '$.pseudoAccount', Description nvarchar(1000) '$.description',
    Agreement nvarchar(300) '$.agreement', AgreementLine int '$.agreementLine', Period char(6) '$.period',
    InvoicingPeriod int '$.invoicingPeriod', Customer nvarchar(300) '$.customer', Supplier nvarchar(300) '$.supplier',
    Invoice nvarchar(300) '$.invoice', RefNo nvarchar(300) '$.refNo', PaymentId nvarchar(300) '$.paymentId',
    Debit decimal(28,6) '$.debit', Credit decimal(28,6) '$.credit', Ledger nvarchar(100) '$.ledger',
    Currency nvarchar(20) '$.currency', CurrencyRate decimal(28,12) '$.currencyRate', Reversed bit '$.reversed',
    ReversesLine int '$.reversesLine', Formula nvarchar(300) '$.formula',
    ExternalAccountString nvarchar(1000) '$.externalAccountString', AmountType nvarchar(200) '$.amountType',
    AmountCode nvarchar(200) '$.amountCode', ConditionValue nvarchar(1000) '$.conditionValue') l;
  INSERT dbo.JournalPostedEvent (Id, PublishedAt, LegalEntityId, EntityCode, CorrelationId, AccountingEvent,
    Status, JournalNumber, GliPrefix, ReversesGli, BookingDate, Agreement, LineCount, TotalDebit, TotalCredit, Difference, Source)
  SELECT Id, PublishedAt, LegalEntityId, EntityCode, CorrelationId, AccountingEvent, Status, JournalNumber,
    GliPrefix, ReversesGli, BookingDate, Agreement, LineCount, TotalDebit, TotalCredit, Difference, Source
  FROM OPENJSON(@StateJson, '$.journalEvents') WITH (
    Id int '$.id', PublishedAt nvarchar(50) '$.publishedAt', LegalEntityId int '$.legalEntityId',
    EntityCode nvarchar(100) '$.entityCode', CorrelationId nvarchar(300) '$.correlationId',
    AccountingEvent nvarchar(300) '$.accountingEvent', Status nvarchar(30) '$.status',
    JournalNumber int '$.journalNumber', GliPrefix nvarchar(100) '$.gliPrefix', ReversesGli int '$.reversesGli',
    BookingDate date '$.bookingDate', Agreement nvarchar(300) '$.agreement', LineCount int '$.lineCount',
    TotalDebit decimal(28,6) '$.totalDebit', TotalCredit decimal(28,6) '$.totalCredit',
    Difference bit '$.difference', Source nvarchar(300) '$.source');
  INSERT dbo.JournalEventAgreementLine (EventId, Ordinal, AgreementLine)
  SELECT e.Id, CONVERT(int, a.[key]), TRY_CONVERT(int, a.[value])
  FROM OPENJSON(@StateJson, '$.journalEvents') WITH (Id int '$.id', AgreementLines nvarchar(max) '$.agreementLines' AS JSON) e
  CROSS APPLY OPENJSON(e.AgreementLines) a;
  INSERT dbo.JournalEventInvoice (EventId, Ordinal, Invoice)
  SELECT e.Id, CONVERT(int, a.[key]), CONVERT(nvarchar(300), a.[value])
  FROM OPENJSON(@StateJson, '$.journalEvents') WITH (Id int '$.id', Invoices nvarchar(max) '$.invoices' AS JSON) e
  CROSS APPLY OPENJSON(e.Invoices) a;
  INSERT dbo.JournalEventReference (EventId, Ordinal, Reference)
  SELECT e.Id, CONVERT(int, a.[key]), CONVERT(nvarchar(300), a.[value])
  FROM OPENJSON(@StateJson, '$.journalEvents') WITH (Id int '$.id', [References] nvarchar(max) '$.references' AS JSON) e
  CROSS APPLY OPENJSON(e.[References]) a;
  INSERT dbo.PendingMessage (Id, LegalEntityId, AccountingClassId, AccountingEventId, EventName, Period,
    InvoicingPeriod, BookingDate, CalculationDate, Agreement, AgreementLine, Portfolio, Product, Customer, Supplier,
    Invoice, ReferenceNumber, Currency, CurrencyRate, Status, ReceivedDate, ReleasedGli, Source)
  SELECT Id, LegalEntityId, AccountingClassId, AccountingEventId, EventName, Period, InvoicingPeriod, BookingDate,
    CalculationDate, Agreement, AgreementLine, Portfolio, Product, Customer, Supplier, Invoice, ReferenceNumber,
    Currency, CurrencyRate, Status, ReceivedDate, ReleasedGli, Source
  FROM OPENJSON(@StateJson, '$.pendingMessages') WITH (
    Id int '$.id', LegalEntityId int '$.legalEntityId', AccountingClassId int '$.accountingClassId',
    AccountingEventId int '$.accountingEventId', EventName nvarchar(300) '$.eventName', Period char(6) '$.period',
    InvoicingPeriod int '$.invoicingPeriod', BookingDate date '$.bookingDate', CalculationDate date '$.calculationDate',
    Agreement nvarchar(300) '$.agreement', AgreementLine nvarchar(100) '$.agreementLine', Portfolio nvarchar(300) '$.portfolio',
    Product nvarchar(300) '$.product', Customer nvarchar(300) '$.customer', Supplier nvarchar(300) '$.supplier',
    Invoice nvarchar(300) '$.invoice', ReferenceNumber nvarchar(300) '$.referenceNumber', Currency nvarchar(20) '$.currency',
    CurrencyRate decimal(28,12) '$.currencyRate', Status nvarchar(30) '$.status', ReceivedDate datetime2(7) '$.receivedDate',
    ReleasedGli int '$.releasedGli', Source nvarchar(300) '$.source');
  INSERT dbo.PendingMessageConditionInput (PendingMessageId, ConditionValueId, Value)
  SELECT m.Id, TRY_CONVERT(int, v.[key]), CONVERT(nvarchar(1000), v.[value])
  FROM OPENJSON(@StateJson, '$.pendingMessages') WITH (Id int '$.id', Inputs nvarchar(max) '$.conditionInputs' AS JSON) m
  CROSS APPLY OPENJSON(m.Inputs) v;
  INSERT dbo.PendingMessageAmount (PendingMessageId, AmountTypeId, Amount)
  SELECT m.Id, TRY_CONVERT(int, v.[key]), TRY_CONVERT(decimal(28,6), v.[value])
  FROM OPENJSON(@StateJson, '$.pendingMessages') WITH (Id int '$.id', Amounts nvarchar(max) '$.amounts' AS JSON) m
  CROSS APPLY OPENJSON(m.Amounts) v;
  INSERT dbo.PendingMessageAccountValue (PendingMessageId, Name, Value)
  SELECT m.Id, v.[key], CONVERT(nvarchar(1000), v.[value])
  FROM OPENJSON(@StateJson, '$.pendingMessages') WITH (Id int '$.id', ValuesJson nvarchar(max) '$.accountValues' AS JSON) m
  CROSS APPLY OPENJSON(m.ValuesJson) v;
  INSERT dbo.AccrualItem (Id, EntityCode, AccrualCodeId, AccrualCode, AccrualName, Agreement, AgreementLine,
    TotalAmount, Currency, StartPeriod, EndPeriod, AmountAccrued, AmountRemaining, Status, CreatedDate, SourceGli,
    ContextPortfolio, ContextProduct, ContextCustomer, ContextSupplier)
  SELECT Id, EntityCode, AccrualCodeId, AccrualCode, AccrualName, Agreement, AgreementLine, TotalAmount, Currency,
    StartPeriod, EndPeriod, AmountAccrued, AmountRemaining, Status, CreatedDate, SourceGli,
    ContextPortfolio, ContextProduct, ContextCustomer, ContextSupplier
  FROM OPENJSON(@StateJson, '$.accrualItems') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', AccrualCodeId int '$.accrualCodeId',
    AccrualCode nvarchar(100) '$.accrualCode', AccrualName nvarchar(300) '$.accrualName',
    Agreement nvarchar(300) '$.agreement', AgreementLine int '$.agreementLine', TotalAmount decimal(28,6) '$.totalAmount',
    Currency nvarchar(20) '$.currency', StartPeriod char(6) '$.startPeriod', EndPeriod char(6) '$.endPeriod',
    AmountAccrued decimal(28,6) '$.amountAccrued', AmountRemaining decimal(28,6) '$.amountRemaining',
    Status nvarchar(30) '$.status', CreatedDate date '$.createdDate', SourceGli int '$.sourceGli',
    ConditionInputs nvarchar(max) '$.conditionInputs' AS JSON,
    MessageContext nvarchar(max) '$.messageContext' AS JSON,
    ContextPortfolio nvarchar(300) '$.messageContext.portfolio', ContextProduct nvarchar(300) '$.messageContext.product',
    ContextCustomer nvarchar(300) '$.messageContext.customer', ContextSupplier nvarchar(300) '$.messageContext.supplier') a;
  INSERT dbo.AccrualConditionInput (AccrualItemId, ConditionValueId, Value)
  SELECT a.Id, TRY_CONVERT(int, v.[key]), CONVERT(nvarchar(1000), v.[value])
  FROM OPENJSON(@StateJson, '$.accrualItems') WITH (Id int '$.id', Inputs nvarchar(max) '$.conditionInputs' AS JSON) a
  CROSS APPLY OPENJSON(a.Inputs) v;
  INSERT dbo.AccrualAccountValue (AccrualItemId, Name, Value)
  SELECT a.Id, v.[key], CONVERT(nvarchar(1000), v.[value])
  FROM OPENJSON(@StateJson, '$.accrualItems') WITH (
    Id int '$.id', MessageContext nvarchar(max) '$.messageContext' AS JSON) a
  CROSS APPLY OPENJSON(a.MessageContext) WITH (AccountValues nvarchar(max) '$.accountValues' AS JSON) c
  CROSS APPLY OPENJSON(c.AccountValues) v;
  INSERT dbo.AccrualScheduleLine (Id, AccrualItemId, Period, PlannedAmount, RecognizedAmount, RecognizedGli, Status)
  SELECT Id, AccrualItemId, Period, PlannedAmount, RecognizedAmount, RecognizedGli, Status
  FROM OPENJSON(@StateJson, '$.accrualScheduleLines') WITH (
    Id int '$.id', AccrualItemId int '$.accrualItemId', Period char(6) '$.period',
    PlannedAmount decimal(28,6) '$.plannedAmount', RecognizedAmount decimal(28,6) '$.recognizedAmount',
    RecognizedGli int '$.recognizedGli', Status nvarchar(30) '$.status');
  INSERT dbo.RecognitionPlan (Id, LegalEntityId, EntityCode, Agreement, AgreementDescription, Customer, Currency,
    Classification, Status, GoingForward, ReceivedDate, Source, SourceGli, Imported)
  SELECT Id, LegalEntityId, EntityCode, Agreement, AgreementDescription, Customer, Currency, Classification,
    Status, GoingForward, ReceivedDate, Source, SourceGli, Imported
  FROM OPENJSON(@StateJson, '$.recognitionPlans') WITH (
    Id int '$.id', LegalEntityId int '$.legalEntityId', EntityCode nvarchar(100) '$.entityCode',
    Agreement nvarchar(300) '$.agreement', AgreementDescription nvarchar(1000) '$.agreementDescription',
    Customer nvarchar(300) '$.customer', Currency nvarchar(20) '$.currency', Classification nvarchar(30) '$.classification',
    Status nvarchar(30) '$.status', GoingForward bit '$.goingForward', ReceivedDate date '$.receivedDate',
    Source nvarchar(300) '$.source', SourceGli int '$.sourceGli', Imported bit '$.imported',
    Lines nvarchar(max) '$.lines' AS JSON) p;
  INSERT dbo.RecognitionPlanLine (PlanId, AgreementLine, AssetDescription, ImportedBookedToPeriod,
    ImportedInvoicedToPeriod, ImportedDepreciationType)
  SELECT p.Id, l.AgreementLine, l.AssetDescription, i.BookedToPeriod, i.InvoicedToPeriod, i.DepreciationType
  FROM OPENJSON(@StateJson, '$.recognitionPlans') WITH (Id int '$.id', Lines nvarchar(max) '$.lines' AS JSON) p
  CROSS APPLY OPENJSON(p.Lines) WITH (
    AgreementLine int '$.agreementLine', AssetDescription nvarchar(1000) '$.assetDescription',
    Schedule nvarchar(max) '$.schedule' AS JSON, Imported nvarchar(max) '$.imported' AS JSON) l
  OUTER APPLY OPENJSON(l.Imported) WITH (
    BookedToPeriod char(6) '$.bookedToPeriod', InvoicedToPeriod int '$.invoicedToPeriod',
    DepreciationType nvarchar(100) '$.depreciationType') i;
  INSERT dbo.RecognitionSchedule (PlanId, AgreementLine, Ordinal, Period, CategoryId, Amount)
  SELECT p.Id, l.AgreementLine, CONVERT(int, s.[key]), r.Period, r.CategoryId, r.Amount
  FROM OPENJSON(@StateJson, '$.recognitionPlans') WITH (Id int '$.id', Lines nvarchar(max) '$.lines' AS JSON) p
  CROSS APPLY OPENJSON(p.Lines) WITH (AgreementLine int '$.agreementLine', Schedule nvarchar(max) '$.schedule' AS JSON) l
  CROSS APPLY OPENJSON(l.Schedule) s
  CROSS APPLY OPENJSON(s.[value]) WITH (Period char(6) '$.period', CategoryId int '$.categoryId', Amount decimal(28,6) '$.amount') r;
  INSERT dbo.ImportedRecognitionSchedule (PlanId, AgreementLine, Ordinal, Period, InvoicingPeriod, Amortization, Interest, Depreciation)
  SELECT p.Id, l.AgreementLine, CONVERT(int, s.[key]), r.Period, r.InvoicingPeriod, r.Amortization, r.Interest, r.Depreciation
  FROM OPENJSON(@StateJson, '$.recognitionPlans') WITH (Id int '$.id', Lines nvarchar(max) '$.lines' AS JSON) p
  CROSS APPLY OPENJSON(p.Lines) WITH (AgreementLine int '$.agreementLine', Imported nvarchar(max) '$.imported' AS JSON) l
  CROSS APPLY OPENJSON(l.Imported) WITH (Rows nvarchar(max) '$.rows' AS JSON) i
  CROSS APPLY OPENJSON(i.Rows) s
  CROSS APPLY OPENJSON(s.[value]) WITH (
    Period char(6) '$.period', InvoicingPeriod int '$.invoicingPeriod', Amortization decimal(28,6) '$.amortization',
    Interest decimal(28,6) '$.interest', Depreciation decimal(28,6) '$.depreciation') r;
  INSERT dbo.RecognitionState (Id, EntityCode, Agreement, AgreementLine, CategoryId, LastPeriod,
    RecognizedToDate, InvoicedToDate, Position, LastGli)
  SELECT Id, EntityCode, Agreement, AgreementLine, CategoryId, LastPeriod, RecognizedToDate,
    InvoicedToDate, Position, LastGli FROM OPENJSON(@StateJson, '$.recognitionStates') WITH (
      Id int '$.id', EntityCode nvarchar(100) '$.entityCode', Agreement nvarchar(300) '$.agreement',
      AgreementLine int '$.agreementLine', CategoryId int '$.categoryId', LastPeriod char(6) '$.lastPeriod',
      RecognizedToDate decimal(28,6) '$.recognizedToDate', InvoicedToDate decimal(28,6) '$.invoicedToDate',
      Position decimal(28,6) '$.position', LastGli int '$.lastGli');
  INSERT dbo.RevalueAccount (Id, EntityCode, Account, Period, Currency, RatePrev, Rate, CurrencyValueBF,
    BaseValueBF, Revaluation, NewBookingsBase, BaseValueCF, ClosingAmount, CurrencyClosing, RevalueGli)
  SELECT Id, EntityCode, Account, Period, Currency, RatePrev, Rate, CurrencyValueBF, BaseValueBF, Revaluation,
    NewBookingsBase, BaseValueCF, ClosingAmount, CurrencyClosing, RevalueGli
  FROM OPENJSON(@StateJson, '$.revalueAccounts') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', Account nvarchar(100) '$.account', Period char(6) '$.period',
    Currency nvarchar(20) '$.currency', RatePrev decimal(28,12) '$.ratePrev', Rate decimal(28,12) '$.rate',
    CurrencyValueBF decimal(28,6) '$.currencyValueBF', BaseValueBF decimal(28,6) '$.baseValueBF',
    Revaluation decimal(28,6) '$.revaluation', NewBookingsBase decimal(28,6) '$.newBookingsBase',
    BaseValueCF decimal(28,6) '$.baseValueCF', ClosingAmount decimal(28,6) '$.closingAmount',
    CurrencyClosing decimal(28,6) '$.currencyClosing', RevalueGli int '$.revalueGli');
  INSERT dbo.RevalueTransaction (Id, EntityCode, Account, Period, Currency, SourceGli, SourceLine, Revalue,
    BookingRate, CurrentRate, TransactionAmount, BookedAmount, Revaluation, RevalueGli, NewBookedAmount)
  SELECT Id, EntityCode, Account, Period, Currency, SourceGli, SourceLine, Revalue, BookingRate, CurrentRate,
    TransactionAmount, BookedAmount, Revaluation, RevalueGli, NewBookedAmount
  FROM OPENJSON(@StateJson, '$.revalueTransactions') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', Account nvarchar(100) '$.account', Period char(6) '$.period',
    Currency nvarchar(20) '$.currency', SourceGli int '$.sourceGli', SourceLine int '$.sourceLine', Revalue bit '$.revalue',
    BookingRate decimal(28,12) '$.bookingRate', CurrentRate decimal(28,12) '$.currentRate',
    TransactionAmount decimal(28,6) '$.transactionAmount', BookedAmount decimal(28,6) '$.bookedAmount',
    Revaluation decimal(28,6) '$.revaluation', RevalueGli int '$.revalueGli', NewBookedAmount decimal(28,6) '$.newBookedAmount');
  INSERT dbo.ExportBatch (Id, LegalEntityId, Ledger, Period, GeneratedAt, GeneratedBy, Summarized, LineCount,
    TotalDebit, TotalCredit, BaseCurrency, TotalBaseDebit, TotalBaseCredit, Transport, Status, FileName,
    Sequence, OutboundPath, ArchivePath, Attempts, DeliveredAt, DeliveryRef, DeliveryError)
  SELECT Id, LegalEntityId, Ledger, Period, GeneratedAt, GeneratedBy, Summarized, LineCount, TotalDebit, TotalCredit,
    BaseCurrency, TotalBaseDebit, TotalBaseCredit, Transport, Status, FileName, Sequence, OutboundPath,
    ArchivePath, Attempts, DeliveredAt, DeliveryRef, DeliveryError
  FROM OPENJSON(@StateJson, '$.exportBatches') WITH (
    Id int '$.id', LegalEntityId int '$.legalEntityId', Ledger nvarchar(100) '$.ledger', Period char(6) '$.period',
    GeneratedAt nvarchar(50) '$.generatedAt', GeneratedBy nvarchar(200) '$.generatedBy', Summarized bit '$.summarized',
    LineCount int '$.lineCount', TotalDebit decimal(28,6) '$.totalDebit', TotalCredit decimal(28,6) '$.totalCredit',
    BaseCurrency nvarchar(20) '$.baseCurrency', TotalBaseDebit decimal(28,6) '$.totalBaseDebit',
    TotalBaseCredit decimal(28,6) '$.totalBaseCredit', Transport nvarchar(30) '$.transport', Status nvarchar(30) '$.status',
    FileName nvarchar(1000) '$.fileName', Sequence int '$.sequence', OutboundPath nvarchar(2000) '$.outboundPath',
    ArchivePath nvarchar(2000) '$.archivePath', Attempts int '$.attempts', DeliveredAt nvarchar(50) '$.deliveredAt',
    DeliveryRef nvarchar(300) '$.deliveryRef', DeliveryError nvarchar(2000) '$.deliveryError');
  INSERT dbo.ExportBatchJournal (BatchId, Ordinal, GliNumber)
  SELECT b.Id, CONVERT(int, v.[key]), TRY_CONVERT(int, v.[value])
  FROM OPENJSON(@StateJson, '$.exportBatches') WITH (Id int '$.id', GliList nvarchar(max) '$.gliList' AS JSON) b
  CROSS APPLY OPENJSON(b.GliList) v;
  INSERT dbo.ExportBatchLine (BatchId, Line, ExternalAccount, ExternalDescription, Ledger, VoucherNo,
    BaseDebit, BaseCredit, Debit, Credit, Currency, BookingDate, Period, Dimensions, Text, SourceGli)
  SELECT b.Id, CONVERT(int, l.[key]), r.ExternalAccount, r.ExternalDescription, r.Ledger, r.VoucherNo,
    r.BaseDebit, r.BaseCredit, r.Debit, r.Credit, r.Currency, r.BookingDate, r.Period, r.Dimensions, r.Text, r.SourceGli
  FROM OPENJSON(@StateJson, '$.exportBatches') WITH (Id int '$.id', Lines nvarchar(max) '$.lines' AS JSON) b
  CROSS APPLY OPENJSON(b.Lines) l
  CROSS APPLY OPENJSON(l.[value]) WITH (
    ExternalAccount nvarchar(200) '$.externalAccount', ExternalDescription nvarchar(1000) '$.externalDescription',
    Ledger nvarchar(100) '$.ledger', VoucherNo nvarchar(100) '$.voucherNo', BaseDebit decimal(28,6) '$.baseDebit',
    BaseCredit decimal(28,6) '$.baseCredit', Debit decimal(28,6) '$.debit', Credit decimal(28,6) '$.credit',
    Currency nvarchar(20) '$.currency', BookingDate date '$.bookingDate', Period char(6) '$.period',
    Dimensions nvarchar(1000) '$.dimensions', Text nvarchar(2000) '$.text', SourceGli int '$.sourceGli') r;
  INSERT dbo.OpeningBalance (Id, EntityCode, Ledger, FiscalYear, PseudoAccount, Description, Debit, Credit)
  SELECT Id, EntityCode, Ledger, FiscalYear, PseudoAccount, Description, Debit, Credit
  FROM OPENJSON(@StateJson, '$.openingBalances') WITH (
    Id int '$.id', EntityCode nvarchar(100) '$.entityCode', Ledger nvarchar(100) '$.ledger', FiscalYear int '$.fiscalYear',
    PseudoAccount nvarchar(100) '$.pseudoAccount', Description nvarchar(1000) '$.description',
    Debit decimal(28,6) '$.debit', Credit decimal(28,6) '$.credit');

  UPDATE dbo.StoreMetadata SET InitializedAt = COALESCE(InitializedAt, SYSUTCDATETIME()) WHERE StoreKey = N'app';
  COMMIT TRANSACTION;
END;
GO
CREATE OR ALTER PROCEDURE dbo.GetDemoState
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @state nvarchar(max);
  IF NOT EXISTS (SELECT 1 FROM dbo.StoreMetadata WHERE StoreKey = N'app' AND InitializedAt IS NOT NULL)
  BEGIN
    SELECT CAST(NULL AS nvarchar(max)) AS StateJson;
    RETURN;
  END;

  SELECT @state = (
    SELECT
      JSON_QUERY((SELECT Id AS id, Code AS code, Name AS name, Rate AS rate, AsOf AS asOf FROM dbo.Currency ORDER BY Id FOR JSON PATH)) AS currencies,
      JSON_QUERY((SELECT Id AS id, Kind AS kind, Name AS name, FullName AS fullName, OrgNumber AS orgNumber,
        Address1 AS address1, Address2 AS address2, Zip AS zip, City AS city, CountyState AS countyState,
        Country AS country, TaxCountry AS taxCountry, Phone AS phone, Email AS email
        FROM dbo.Party ORDER BY Id FOR JSON PATH)) AS parties,
      JSON_QUERY((SELECT Id AS id, PartyId AS partyId, LegalEntityId AS legalEntityId FROM dbo.OrganizationUnit ORDER BY Id FOR JSON PATH)) AS organizationUnits,
      JSON_QUERY((SELECT e.Id AS id, e.Name AS name, e.Description AS description, e.OwnerPartyId AS ownerPartyId,
        e.OwnerCode AS ownerCode, JSON_QUERY((SELECT PartyId AS partyId, Kind AS kind, Name AS name, FullName AS fullName,
          Reference AS reference, Address AS address, City AS city, Country AS country, Email AS email, Phone AS phone, AsOf AS asOf
          FROM dbo.LegalEntityPartySnapshot p WHERE p.LegalEntityId = e.Id AND p.Role = N'Owner' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS owner,
        JSON_QUERY((SELECT PartyId AS partyId, Kind AS kind, Name AS name, FullName AS fullName,
          Reference AS reference, Address AS address, City AS city, Country AS country, Email AS email, Phone AS phone, AsOf AS asOf
          FROM dbo.LegalEntityPartySnapshot p WHERE p.LegalEntityId = e.Id AND p.Role = N'Responsible' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS responsibleRef,
        JSON_QUERY((SELECT PartyId AS partyId, Kind AS kind, Name AS name, FullName AS fullName,
          Reference AS reference, Address AS address, City AS city, Country AS country, Email AS email, Phone AS phone, AsOf AS asOf
          FROM dbo.LegalEntityPartySnapshot p WHERE p.LegalEntityId = e.Id AND p.Role = N'Controller' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS controllerRef,
        e.BaseCurrencyId AS baseCurrencyId, e.Revaluation AS revaluation,
        e.RevaluationResultAccount AS revaluationResultAccount, e.ExchangeDifferenceAccount AS exchangeDifferenceAccount,
        e.GliNumberSerie AS gliNumberSerie, e.GliPrefix AS gliPrefix, e.CoaId AS coaId, e.Responsible AS responsible,
        e.ResponsiblePartyId AS responsiblePartyId, e.ControllerPartyId AS controllerPartyId,
        e.FiscalYearStartMonth AS fiscalYearStartMonth, e.EndOfMonth AS endOfMonth, e.ClosedPeriod AS closedPeriod,
        e.GlInterfaceDate AS glInterfaceDate, e.OpenPeriod AS openPeriod, e.JournalDifferences AS journalDifferences,
        e.NextGli AS nextGli, e.DimensionSeparator AS dimensionSeparator, e.ShowInTabs AS showInTabs
        FROM dbo.LegalEntity e ORDER BY e.Id FOR JSON PATH)) AS legalEntities,
      JSON_QUERY((SELECT Id AS id, Code AS code, Name AS name, Description AS description FROM dbo.AccountingClass ORDER BY Id FOR JSON PATH)) AS accountingClasses,
      JSON_QUERY((SELECT Id AS id, LegalEntityId AS legalEntityId, AccountingClassId AS accountingClassId FROM dbo.LegalAccountingClass ORDER BY Id FOR JSON PATH)) AS legalAccountingClasses,
      JSON_QUERY((SELECT Id AS id, Code AS code, Name AS name, Description AS description FROM dbo.Ledger ORDER BY Id FOR JSON PATH)) AS ledgers,
      JSON_QUERY((SELECT Id AS id, LegalAccountingClassId AS legalAccountingClassId, LedgerId AS ledgerId FROM dbo.LegalAccountingLedger ORDER BY Id FOR JSON PATH)) AS legalAccountingLedgers,
      JSON_QUERY((SELECT Id AS id, Name AS name, Description AS description, AmountGroup AS amountGroup,
        AllowsMultipleCodes AS allowsMultipleCodes, System AS system FROM dbo.AmountType ORDER BY Id FOR JSON PATH)) AS amountTypes,
      JSON_QUERY((SELECT Id AS id, Name AS name FROM dbo.ConditionValue ORDER BY Id FOR JSON PATH)) AS conditionValues,
      JSON_QUERY((SELECT Id AS id, ConditionValueId AS conditionValueId, Code AS code, Description AS description
        FROM dbo.ConditionValueOption ORDER BY Id FOR JSON PATH)) AS conditionValueOptions,
      JSON_QUERY((SELECT Id AS id, Name AS name, Description AS description FROM dbo.EventCategory ORDER BY Id FOR JSON PATH)) AS eventCategories,
      JSON_QUERY((SELECT Id AS id, Name AS name, Description AS description, Code AS code, BookingDate AS bookingDate,
        EventCategoryId AS eventCategoryId, OriginalEventId AS originalEventId, PostingMode AS postingMode,
        ReverseMatchBy AS reverseMatchBy, UsesAccountingRules AS usesAccountingRules
        FROM dbo.AccountingEvent ORDER BY Id FOR JSON PATH)) AS accountingEvents,
      JSON_QUERY((SELECT f.Id AS id, f.Name AS name, f.Description AS description, f.AmountTypeId AS amountTypeId,
        f.DebitAccount AS debitAccount, f.CreditAccount AS creditAccount, f.FormulaConditionId AS formulaConditionId,
        f.Category AS category, f.ExcludeFromRevaluation AS excludeFromRevaluation, f.ReverseMonthly AS reverseMonthly,
        JSON_QUERY(COALESCE((SELECT N'[' + STRING_AGG(CONVERT(nvarchar(max), EventId), N',') WITHIN GROUP (ORDER BY a.Ordinal) + N']'
          FROM dbo.FormulaAppliesToEvent a WHERE a.FormulaOrdinal = f.RowOrdinal), N'[]')) AS appliesToEvents
        FROM dbo.Formula f ORDER BY f.RowOrdinal FOR JSON PATH)) AS formulas,
      JSON_QUERY((SELECT Id AS id, Name AS name FROM dbo.FormulaCondition ORDER BY Id FOR JSON PATH)) AS formulaConditions,
      JSON_QUERY((SELECT Id AS id, FormulaConditionId AS formulaConditionId, Level AS level, ConditionValueId AS conditionValueId,
        Value AS value, DebitPseudoAccountId AS debitPseudoAccountId, CreditPseudoAccountId AS creditPseudoAccountId,
        Operator AS operator FROM dbo.Condition ORDER BY Id FOR JSON PATH)) AS conditions,
      JSON_QUERY((SELECT Id AS id, EntityCode AS entityCode, LegalAccountingLedgerId AS legalAccountingLedgerId,
        AccountingEventId AS accountingEventId, FormulaId AS formulaId, DebitCredit AS debitCredit
        FROM dbo.AccountingRule ORDER BY Id FOR JSON PATH)) AS accountingRules,
      JSON_QUERY((SELECT p.EntityCode AS entityCode, p.Id AS id, p.Pseudo AS pseudo, p.Description AS description,
        p.ExtPseudo AS extPseudo, p.ExtDescription AS extDescription, p.Revaluation AS revaluation,
        p.AccountKind AS accountKind, p.SummarizeToGl AS summarizeToGl,
        JSON_QUERY(COALESCE((SELECT N'[' + STRING_AGG(CONVERT(nvarchar(max), ExtAccountPartId), N',') WITHIN GROUP (ORDER BY Ordinal) + N']'
          FROM dbo.PseudoAccountSummaryKeepPart k WHERE k.EntityCode = p.EntityCode AND k.PseudoAccountId = p.Id), N'[]')) AS summaryKeepPartIds
        FROM dbo.PseudoAccount p ORDER BY p.EntityCode, p.Id FOR JSON PATH)) AS pseudoAccounts,
      JSON_QUERY((SELECT Id AS id, Name AS name, Description AS description FROM dbo.ChartOfAccount ORDER BY Id FOR JSON PATH)) AS chartOfAccounts,
      JSON_QUERY((SELECT Id AS id, CoaId AS coaId, Name AS name, Description AS description, [Order] AS [order],
        Depth AS depth, ParentId AS parentId, AccountFrom AS accountFrom, AccountTo AS accountTo
        FROM dbo.CoaNode ORDER BY CoaId, Id FOR JSON PATH)) AS coaNodes,
      JSON_QUERY((SELECT Id AS id, Name AS name, Level AS level, DataType AS dataType, Source AS source, MessageField AS messageField
        FROM dbo.ExtAccountValue ORDER BY Id FOR JSON PATH)) AS extAccountValues,
      JSON_QUERY((SELECT Id AS id, LegalEntityId AS legalEntityId, ExtAccountValueId AS extAccountValueId,
        PartNumber AS partNumber, Name AS name, Length AS length, Required AS required
        FROM dbo.ExtAccountPart ORDER BY LegalEntityId, PartNumber FOR JSON PATH)) AS extAccountParts,
      JSON_QUERY((SELECT Id AS id, EntityCode AS entityCode, PseudoAccountId AS pseudoAccountId,
        ExtAccountPartId AS extAccountPartId, InUse AS inUse FROM dbo.PseudoAccountExtPart ORDER BY Id FOR JSON PATH)) AS pseudoAccountExtParts,
      JSON_QUERY((SELECT l.Id AS id, l.EntityCode AS entityCode, l.PseudoAccountId AS pseudoAccountId, l.CoaNodeId AS coaNodeId
        FROM dbo.PseudoAccountCoaLink l ORDER BY l.Id FOR JSON PATH)) AS pseudoAccountCoaLinks,
      JSON_QUERY((SELECT Id AS id, LegalEntityId AS legalEntityId, Name AS name, Description AS description,
        [Order] AS [order], Depth AS depth, ParentId AS parentId, AccountFrom AS accountFrom, AccountTo AS accountTo
        FROM dbo.EntityCoaNode ORDER BY LegalEntityId, Id FOR JSON PATH)) AS entityCoaNodes,
      JSON_QUERY((SELECT Id AS id, EntityCode AS entityCode, Code AS code, Name AS name, Direction AS direction,
        Months AS months, DeferralAccount AS deferralAccount, CounterAccount AS counterAccount,
        RecognitionAccount AS recognitionAccount, RecognitionFormulaId AS recognitionFormulaId,
        TriggerAmountTypeId AS triggerAmountTypeId FROM dbo.AccrualCode ORDER BY Id FOR JSON PATH)) AS accrualCodes,
      JSON_QUERY((SELECT Id AS id, EntityCode AS entityCode, Name AS name, Kind AS kind,
        InvoicedAmountType AS invoicedAmountType, AccruedAmountType AS accruedAmountType,
        DeferredAmountType AS deferredAmountType, IncomeAmountType AS incomeAmountType,
        DebitAmountType AS debitAmountType, CreditAmountType AS creditAmountType
        FROM dbo.RecognitionCategory ORDER BY EntityCode, Id FOR JSON PATH)) AS recognitionCategories,
      JSON_QUERY((SELECT Id AS id, AccrualItemId AS accrualItemId, Period AS period, PlannedAmount AS plannedAmount,
        RecognizedAmount AS recognizedAmount, RecognizedGli AS recognizedGli, Status AS status
        FROM dbo.AccrualScheduleLine ORDER BY AccrualItemId, Period, Id FOR JSON PATH)) AS accrualScheduleLines,
      JSON_QUERY((SELECT p.Id AS id, p.LegalEntityId AS legalEntityId, p.EntityCode AS entityCode, p.Agreement AS agreement,
        p.AgreementDescription AS agreementDescription, p.Customer AS customer, p.Currency AS currency,
        p.Classification AS classification, p.Status AS status, p.GoingForward AS goingForward,
        p.ReceivedDate AS receivedDate, p.Source AS source, p.SourceGli AS sourceGli, p.Imported AS imported,
        JSON_QUERY((SELECT l.AgreementLine AS agreementLine, l.AssetDescription AS assetDescription,
          JSON_QUERY((SELECT s.Period AS period, s.CategoryId AS categoryId, s.Amount AS amount
            FROM dbo.RecognitionSchedule s WHERE s.PlanId = l.PlanId AND s.AgreementLine = l.AgreementLine
            ORDER BY s.Ordinal FOR JSON PATH)) AS schedule,
          JSON_QUERY((SELECT l.ImportedBookedToPeriod AS bookedToPeriod, l.ImportedInvoicedToPeriod AS invoicedToPeriod,
            l.ImportedDepreciationType AS depreciationType,
            JSON_QUERY((SELECT r.Period AS period, r.InvoicingPeriod AS invoicingPeriod,
              r.Amortization AS amortization, r.Interest AS interest, r.Depreciation AS depreciation
              FROM dbo.ImportedRecognitionSchedule r WHERE r.PlanId = l.PlanId AND r.AgreementLine = l.AgreementLine
              ORDER BY r.Ordinal FOR JSON PATH)) AS rows
            WHERE l.ImportedBookedToPeriod IS NOT NULL FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS imported
          FROM dbo.RecognitionPlanLine l WHERE l.PlanId = p.Id ORDER BY l.AgreementLine FOR JSON PATH)) AS lines
        FROM dbo.RecognitionPlan p ORDER BY p.Id FOR JSON PATH)) AS recognitionPlans,
      JSON_QUERY((SELECT Id AS id, EntityCode AS entityCode, Agreement AS agreement, AgreementLine AS agreementLine,
        CategoryId AS categoryId, LastPeriod AS lastPeriod, RecognizedToDate AS recognizedToDate,
        InvoicedToDate AS invoicedToDate, Position AS position, LastGli AS lastGli
        FROM dbo.RecognitionState ORDER BY Id FOR JSON PATH)) AS recognitionStates,
      JSON_QUERY((SELECT Id AS id, EntityCode AS entityCode, Account AS account, Period AS period, Currency AS currency,
        RatePrev AS ratePrev, Rate AS rate, CurrencyValueBF AS currencyValueBF, BaseValueBF AS baseValueBF,
        Revaluation AS revaluation, NewBookingsBase AS newBookingsBase, BaseValueCF AS baseValueCF,
        ClosingAmount AS closingAmount, CurrencyClosing AS currencyClosing, RevalueGli AS revalueGli
        FROM dbo.RevalueAccount ORDER BY Id FOR JSON PATH)) AS revalueAccounts,
      JSON_QUERY((SELECT Id AS id, EntityCode AS entityCode, Account AS account, Period AS period, Currency AS currency,
        SourceGli AS sourceGli, SourceLine AS sourceLine, Revalue AS revalue, BookingRate AS bookingRate,
        CurrentRate AS currentRate, TransactionAmount AS transactionAmount, BookedAmount AS bookedAmount,
        Revaluation AS revaluation, RevalueGli AS revalueGli, NewBookedAmount AS newBookedAmount
        FROM dbo.RevalueTransaction ORDER BY Id FOR JSON PATH)) AS revalueTransactions,
      JSON_QUERY((SELECT Id AS id, LegalEntityId AS legalEntityId, Name AS name, Description AS description,
        FileName AS fileName, FileNamePattern AS fileNamePattern, FileLocation AS fileLocation,
        ArchiveLocation AS archiveLocation, Status AS status, ExecutionType AS executionType,
        NextSequence AS nextSequence, LastExecution AS lastExecution, LastExecutionBy AS lastExecutionBy,
        Records AS records, TargetGl AS targetGl, Format AS format, Transport AS transport, Ledger AS ledger,
        Summarization AS summarization,
        JSON_QUERY(COALESCE((SELECT N'[' + STRING_AGG(CONVERT(nvarchar(max), ExtAccountPartId), N',') WITHIN GROUP (ORDER BY Ordinal) + N']'
          FROM dbo.IntegrationDefaultKeepPart k WHERE k.IntegrationId = i.Id), N'[]')) AS defaultKeepPartIds
        FROM dbo.Integration i ORDER BY i.Id FOR JSON PATH)) AS integrations,
      JSON_QUERY((SELECT Id AS id, LegalEntityId AS legalEntityId, Ledger AS ledger, Prefix AS prefix, NextNumber AS nextNumber
        FROM dbo.LedgerSeries ORDER BY Id FOR JSON PATH)) AS ledgerSeries,
      JSON_QUERY((SELECT j.LegalEntityId AS legalEntityId, j.GliNumber AS gliNumber, j.GliPrefix AS gliPrefix,
        j.AccountingEvent AS accountingEvent,
        JSON_QUERY((SELECT l.Line AS line, l.PseudoAccount AS pseudoAccount, l.Description AS description,
          l.Agreement AS agreement, l.AgreementLine AS agreementLine, l.Period AS period, l.InvoicingPeriod AS invoicingPeriod,
          l.Customer AS customer, l.Supplier AS supplier, l.Invoice AS invoice, l.RefNo AS refNo, l.PaymentId AS paymentId,
          l.Debit AS debit, l.Credit AS credit, l.Ledger AS ledger, l.Currency AS currency, l.CurrencyRate AS currencyRate,
          l.Reversed AS reversed, l.ReversesLine AS reversesLine, l.Formula AS formula,
          l.ExternalAccountString AS externalAccountString, l.AmountType AS amountType, l.AmountCode AS amountCode,
          l.ConditionValue AS conditionValue FROM dbo.JournalLine l
          WHERE l.LegalEntityId = j.LegalEntityId AND l.GliNumber = j.GliNumber ORDER BY l.Line FOR JSON PATH)) AS lines,
        j.LineCount AS lineCount, j.BookingDate AS bookingDate, j.CreateDate AS createDate,
        j.ExportDate AS exportDate, j.ExportVoucher AS exportVoucher, j.Difference AS difference,
        j.CreatedBy AS createdBy, j.Manual AS manual, j.ReversesGli AS reversesGli, j.BroughtForward AS broughtForward
        FROM dbo.Journal j ORDER BY j.Ordinal FOR JSON PATH)) AS journals,
      JSON_QUERY((SELECT e.Id AS id, e.PublishedAt AS publishedAt, e.LegalEntityId AS legalEntityId,
        e.EntityCode AS entityCode, e.CorrelationId AS correlationId, e.AccountingEvent AS accountingEvent,
        e.Status AS status, e.JournalNumber AS journalNumber, e.GliPrefix AS gliPrefix, e.ReversesGli AS reversesGli,
        e.BookingDate AS bookingDate, e.Agreement AS agreement,
        JSON_QUERY(COALESCE((SELECT N'[' + STRING_AGG(CONVERT(nvarchar(max), AgreementLine), N',') WITHIN GROUP (ORDER BY Ordinal) + N']'
          FROM dbo.JournalEventAgreementLine a WHERE a.EventId = e.Id), N'[]')) AS agreementLines,
        JSON_QUERY(COALESCE((SELECT N'[' + STRING_AGG(CONCAT(N'"', STRING_ESCAPE(Invoice, 'json'), N'"'), N',') WITHIN GROUP (ORDER BY Ordinal) + N']'
          FROM dbo.JournalEventInvoice i WHERE i.EventId = e.Id), N'[]')) AS invoices,
        JSON_QUERY(COALESCE((SELECT N'[' + STRING_AGG(CONCAT(N'"', STRING_ESCAPE(Reference, 'json'), N'"'), N',') WITHIN GROUP (ORDER BY Ordinal) + N']'
          FROM dbo.JournalEventReference r WHERE r.EventId = e.Id), N'[]')) AS [references],
        e.LineCount AS lineCount, e.TotalDebit AS totalDebit, e.TotalCredit AS totalCredit,
        e.Difference AS difference, e.Source AS source FROM dbo.JournalPostedEvent e ORDER BY e.Id FOR JSON PATH)) AS journalEvents,
      JSON_QUERY((SELECT m.Id AS id, m.LegalEntityId AS legalEntityId, m.AccountingClassId AS accountingClassId,
        m.AccountingEventId AS accountingEventId, m.EventName AS eventName, m.Period AS period,
        m.InvoicingPeriod AS invoicingPeriod, m.BookingDate AS bookingDate, m.CalculationDate AS calculationDate,
        m.Agreement AS agreement, m.AgreementLine AS agreementLine, m.Portfolio AS portfolio, m.Product AS product,
        m.Customer AS customer, m.Supplier AS supplier, m.Invoice AS invoice, m.ReferenceNumber AS referenceNumber,
        JSON_QUERY(COALESCE((SELECT N'{' + STRING_AGG(CONCAT(N'"', ConditionValueId, N'":"', STRING_ESCAPE(Value, 'json'), N'"'), N',') + N'}'
          FROM dbo.PendingMessageConditionInput x WHERE x.PendingMessageId = m.Id), N'{}')) AS conditionInputs,
        JSON_QUERY(COALESCE((SELECT N'{' + STRING_AGG(CONCAT(N'"', AmountTypeId, N'":', CONVERT(nvarchar(80), Amount)), N',') + N'}'
          FROM dbo.PendingMessageAmount x WHERE x.PendingMessageId = m.Id), N'{}')) AS amounts,
        JSON_QUERY(COALESCE((SELECT N'{' + STRING_AGG(CONCAT(N'"', STRING_ESCAPE(Name, 'json'), N'":"', STRING_ESCAPE(Value, 'json'), N'"'), N',') + N'}'
          FROM dbo.PendingMessageAccountValue x WHERE x.PendingMessageId = m.Id), N'{}')) AS accountValues,
        m.Currency AS currency, m.CurrencyRate AS currencyRate, m.Status AS status, m.ReceivedDate AS receivedDate,
        m.ReleasedGli AS releasedGli, m.Source AS source FROM dbo.PendingMessage m ORDER BY m.Id FOR JSON PATH)) AS pendingMessages,
      JSON_QUERY((SELECT a.Id AS id, a.EntityCode AS entityCode, a.AccrualCodeId AS accrualCodeId,
        a.AccrualCode AS accrualCode, a.AccrualName AS accrualName, a.Agreement AS agreement,
        a.AgreementLine AS agreementLine, a.TotalAmount AS totalAmount, a.Currency AS currency,
        a.StartPeriod AS startPeriod, a.EndPeriod AS endPeriod, a.AmountAccrued AS amountAccrued,
        a.AmountRemaining AS amountRemaining, a.Status AS status, a.CreatedDate AS createdDate, a.SourceGli AS sourceGli,
        JSON_QUERY(COALESCE((SELECT N'{' + STRING_AGG(CONCAT(N'"', ConditionValueId, N'":"', STRING_ESCAPE(Value, 'json'), N'"'), N',') + N'}'
          FROM dbo.AccrualConditionInput x WHERE x.AccrualItemId = a.Id), N'{}')) AS conditionInputs,
        JSON_QUERY((SELECT a.ContextPortfolio AS portfolio, a.ContextProduct AS product,
          a.ContextCustomer AS customer, a.ContextSupplier AS supplier,
          JSON_QUERY(COALESCE((SELECT N'{' + STRING_AGG(CONCAT(N'"', STRING_ESCAPE(Name, 'json'), N'":"', STRING_ESCAPE(Value, 'json'), N'"'), N',') + N'}'
            FROM dbo.AccrualAccountValue x WHERE x.AccrualItemId = a.Id), N'{}')) AS accountValues
          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS messageContext
        FROM dbo.AccrualItem a ORDER BY a.Id FOR JSON PATH)) AS accrualItems,
      JSON_QUERY((SELECT b.Id AS id, b.LegalEntityId AS legalEntityId, b.Ledger AS ledger, b.Period AS period,
        b.GeneratedAt AS generatedAt, b.GeneratedBy AS generatedBy, b.Summarized AS summarized,
        JSON_QUERY(COALESCE((SELECT N'[' + STRING_AGG(CONVERT(nvarchar(max), GliNumber), N',') WITHIN GROUP (ORDER BY Ordinal) + N']'
          FROM dbo.ExportBatchJournal x WHERE x.BatchId = b.Id), N'[]')) AS gliList,
        JSON_QUERY((SELECT l.ExternalAccount AS externalAccount, l.ExternalDescription AS externalDescription,
          l.Ledger AS ledger, l.VoucherNo AS voucherNo, l.BaseDebit AS baseDebit, l.BaseCredit AS baseCredit,
          l.Debit AS debit, l.Credit AS credit, l.Currency AS currency, l.BookingDate AS bookingDate,
          l.Period AS period, l.Dimensions AS dimensions, l.Text AS text, l.SourceGli AS sourceGli
          FROM dbo.ExportBatchLine l WHERE l.BatchId = b.Id ORDER BY l.Line FOR JSON PATH)) AS lines,
        b.LineCount AS lineCount, b.TotalDebit AS totalDebit, b.TotalCredit AS totalCredit,
        b.BaseCurrency AS baseCurrency, b.TotalBaseDebit AS totalBaseDebit, b.TotalBaseCredit AS totalBaseCredit,
        b.Transport AS transport, b.Status AS status, b.FileName AS fileName, b.Sequence AS sequence,
        b.OutboundPath AS outboundPath, b.ArchivePath AS archivePath, b.Attempts AS attempts,
        b.DeliveredAt AS deliveredAt, b.DeliveryRef AS deliveryRef, b.DeliveryError AS deliveryError
        FROM dbo.ExportBatch b ORDER BY b.Id FOR JSON PATH)) AS exportBatches,
      JSON_QUERY((SELECT Id AS id, EntityCode AS entityCode, Ledger AS ledger, FiscalYear AS fiscalYear,
        PseudoAccount AS pseudoAccount, Description AS description, Debit AS debit, Credit AS credit
        FROM dbo.OpeningBalance ORDER BY Id FOR JSON PATH)) AS openingBalances
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

  DECLARE @rootCollections table (JsonPath nvarchar(100) NOT NULL PRIMARY KEY);
  INSERT @rootCollections (JsonPath) VALUES
    ('$.currencies'), ('$.parties'), ('$.organizationUnits'), ('$.legalEntities'),
    ('$.accountingClasses'), ('$.legalAccountingClasses'), ('$.ledgers'), ('$.legalAccountingLedgers'),
    ('$.amountTypes'), ('$.conditionValues'), ('$.conditionValueOptions'), ('$.eventCategories'),
    ('$.accountingEvents'), ('$.formulas'), ('$.formulaConditions'), ('$.conditions'),
    ('$.accountingRules'), ('$.pseudoAccounts'), ('$.chartOfAccounts'), ('$.coaNodes'),
    ('$.extAccountValues'), ('$.extAccountParts'), ('$.journals'), ('$.integrations'),
    ('$.pseudoAccountCoaLinks'), ('$.entityCoaNodes'), ('$.pseudoAccountExtParts'), ('$.accrualCodes'),
    ('$.accrualItems'), ('$.accrualScheduleLines'), ('$.pendingMessages'), ('$.revalueAccounts'),
    ('$.revalueTransactions'), ('$.exportBatches'), ('$.ledgerSeries'), ('$.journalEvents'),
    ('$.recognitionCategories'), ('$.recognitionPlans'), ('$.recognitionStates'), ('$.openingBalances');
  DECLARE @jsonPath nvarchar(100);
  WHILE EXISTS (SELECT 1 FROM @rootCollections)
  BEGIN
    SELECT TOP (1) @jsonPath = JsonPath FROM @rootCollections ORDER BY JsonPath;
    SET @state = JSON_MODIFY(@state, @jsonPath,
      JSON_QUERY(COALESCE(JSON_QUERY(@state, @jsonPath), N'[]')));
    DELETE @rootCollections WHERE JsonPath = @jsonPath;
  END;

  SELECT @state AS StateJson;
END;
GO
BEGIN TRANSACTION;
UPDATE dbo.StoreMetadata SET LegacyWriteEnabled=0 WHERE StoreKey=N'app';
IF OBJECT_ID(N'dbo.AppState',N'U') IS NOT NULL DROP TABLE dbo.AppState;
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE MigrationId='004-remove-json-snapshot')
  INSERT dbo.SchemaMigrations (MigrationId) VALUES ('004-remove-json-snapshot');
COMMIT TRANSACTION;
