using Accounting.Application.Features.LegalEntities;

namespace Accounting.Infrastructure.Seeding;

/// <summary>
/// Platform-provided chart-of-account templates (spec §ChartOfAccount). The US GAAP template
/// is generated from the accounting configuration workbook; an IFRS variant can be added the
/// same way. Templates are code — customers get their own editable copy per legal entity.
/// </summary>
public sealed class CoaTemplateProvider : ICoaTemplateProvider
{
    public const string UsGaap = "US GAAP Chart Of Account";

    public IReadOnlyList<string> TemplateNames { get; } = [UsGaap];

    public IReadOnlyList<(
        string Name,
        string Description,
        string Order,
        int Depth,
        string? ParentOrder
    )> GetTemplate(string templateName)
    {
        if (!string.Equals(templateName, UsGaap, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                $"Unknown chart-of-account template '{templateName}'.",
                nameof(templateName)
            );
        }

        return UsGaapNodes;
    }

    private static readonly (
        string Name,
        string Description,
        string Order,
        int Depth,
        string? ParentOrder
    )[] UsGaapNodes =
    [
        ("1000 Assets", "Account 1000-1999", "1", 0, null),
        ("Cash And Financial Assets", "Account 1000-1199", "1.1", 1, "1"),
        ("Cash And Cash Equivalents", "", "1.1.1", 2, "1.1"),
        ("Financial Assets (Investments)", "", "1.1.2", 2, "1.1"),
        ("Restricted Cash And Financial Assets", "", "1.1.3", 2, "1.1"),
        ("Additional Financial Assets And Investments", "", "1.1.4", 2, "1.1"),
        ("1200 Receivables And Contracts", "Account 1200-1299", "1.2", 1, "1"),
        ("Accounts, Notes And Loans Receivable", "", "1.2.1", 2, "1.2"),
        ("Contracts", "", "1.2.2", 2, "1.2"),
        ("Nontrade And Other Receivables", "", "1.2.3", 2, "1.2"),
        ("1300 - Inventory", "Account 1300-1399", "1.3", 1, "1"),
        ("Merchandise", "", "1.3.1", 2, "1.3"),
        ("Raw Material, Parts And Supplies", "", "1.3.2", 2, "1.3"),
        ("Work In Process", "", "1.3.3", 2, "1.3"),
        ("Finished Goods", "", "1.3.4", 2, "1.3"),
        ("Other Inventory", "", "1.3.5", 2, "1.3"),
        ("1400 - Prepaid expenses & other current assets", "Account 1400-1499", "1.4", 1, "1"),
        ("Prepaid Expense", "", "1.4.1", 2, "1.4"),
        ("Accrued Income", "", "1.4.2", 2, "1.4"),
        ("Additional Assets", "", "1.4.3", 2, "1.4"),
        ("1500 - Property, Plant And Equipment", "Account 1500-1599", "1.5", 1, "1"),
        ("Land And Land Improvements", "", "1.5.1", 2, "1.5"),
        ("Buildings, Structures And Improvements", "", "1.5.2", 2, "1.5"),
        ("Machinery And Equipment", "", "1.5.3", 2, "1.5"),
        ("Furniture And Fixtures", "", "1.5.4", 2, "1.5"),
        ("Additional Property, Plant And Equipment", "", "1.5.5", 2, "1.5"),
        ("Construction In Progress", "", "1.5.6", 2, "1.5"),
        ("1600 - Intangible Assets (Excluding Goodwill)", "Account 1600-1699", "1.6", 1, "1"),
        ("Intellectual Property", "", "1.6.1", 2, "1.6"),
        ("Computer Software", "", "1.6.2", 2, "1.6"),
        ("Trade And Distribution Assets", "", "1.6.3", 2, "1.6"),
        ("Contracts And Rights", "", "1.6.4", 2, "1.6"),
        ("Right To Use Assets (Classified By Type)", "", "1.6.5", 2, "1.6"),
        ("Other Intangible Assets", "", "1.6.6", 2, "1.6"),
        ("Acquisition In Progress", "", "1.6.7", 2, "1.6"),
        ("1700 - Goodwill", "", "1.7", 1, "1"),
        ("2000 - Liabilities", "Account 2000-2999", "2", 0, null),
        ("2100 - Payables", "Account 2000-2199", "2.1", 1, "2"),
        ("Trade Payables", "", "2.1.1", 2, "2.1"),
        ("Dividends Payable", "", "2.1.2", 2, "2.1"),
        ("Interest Payable", "", "2.1.3", 2, "2.1"),
        ("Other Payables", "", "2.1.4", 2, "2.1"),
        ("2200 - Accruals And Other Liabilities", "Account 2200-2299", "2.2", 1, "2"),
        ("Accrued Expenses", "", "2.2.1", 2, "2.2"),
        ("Deferred Income And Refund Liabilities", "", "2.2.2", 2, "2.2"),
        ("Accrued Taxes (Other Than Payroll)", "", "2.2.3", 2, "2.2"),
        ("Other Liabilities", "", "2.2.4", 2, "2.2"),
        ("2300 - Financial Labilities", "Account 2300-2399", "2.3", 1, "2"),
        ("Notes Payable", "", "2.3.1", 2, "2.3"),
        ("Loans Payable", "", "2.3.2", 2, "2.3"),
        ("Bonds (Debentures)", "", "2.3.3", 2, "2.3"),
        ("Other Debts And Borrowings", "", "2.3.4", 2, "2.3"),
        ("Lease Obligations", "", "2.3.5", 2, "2.3"),
        ("Derivative Financial Liabilities", "", "2.3.6", 2, "2.3"),
        ("2400 - Provisions (Contingencies)", "Account 2400-2499", "2.4", 1, "2"),
        ("Customer Related Provisions", "", "2.4.1", 2, "2.4"),
        ("Litigation And Regulatory", "", "2.4.2", 2, "2.4"),
        ("Additional Provisions", "", "2.4.3", 2, "2.4"),
        ("3000 - Equity", "Account 3000-3999", "3", 0, null),
        (
            "3100 - Owners Equity (Attributable To Owners Of Parent)",
            "Account 3000-3199",
            "3.1",
            1,
            "3"
        ),
        ("Equity At Par (Issued Capital)", "", "3.1.1", 2, "3.1"),
        ("Additional Paid-In Capital", "", "3.1.2", 2, "3.1"),
        ("3200 - Retained Earnings", "Account 3200-3299", "3.2", 1, "3"),
        ("Appropriated", "", "3.2.1", 2, "3.2"),
        ("Unappropriated", "", "3.2.2", 2, "3.2"),
        ("Deficit", "", "3.2.3", 2, "3.2"),
        ("In Suspense", "", "3.2.4", 2, "3.2"),
        ("3300 - Accumulated OCI", "Account 3300-3399", "3.3", 1, "3"),
        ("Exchange Differences On Translation", "", "3.3.1", 2, "3.3"),
        ("Remeasurements Cash Flow Hedges", "", "3.3.2", 2, "3.3"),
        ("Remeasurements Available-For-Sale Financial Assets", "", "3.3.3", 2, "3.3"),
        ("Remeasurement Of Defined Benefit Plans", "", "3.3.4", 2, "3.3"),
        ("3400 - Other Equity Items", "Account 3400-3499", "3.4", 1, "3"),
        ("ESOP Related Items", "", "3.4.1", 2, "3.4"),
        ("Subscribed Stock Receivables", "", "3.4.2", 2, "3.4"),
        ("Treasury Stock", "", "3.4.3", 2, "3.4"),
        ("Miscellaneous Equity", "", "3.4.4", 2, "3.4"),
        ("3500 - Non-controlling (Minority) Interest", "Account 3500-3599", "3.5", 1, "3"),
        ("4000 - Revenue", "Account 4000-4999", "4", 0, null),
        ("4100 - Recognized Point Of Time", "Account 4100-4199", "4.1", 1, "4"),
        ("Goods", "", "4.1.1", 2, "4.1"),
        ("Services", "", "4.1.2", 2, "4.1"),
        ("4200 - Recognized Over Time", "Account 4200-4299", "4.2", 1, "4"),
        ("Products", "", "4.2.1", 2, "4.2"),
        ("Services", "", "4.2.2", 2, "4.2"),
        ("4300 - Adjustments", "Account 4300-4399", "4.3", 1, "4"),
        ("Variable Consideration", "", "4.3.1", 2, "4.3"),
        ("Consideration Paid (Payable) To Customers", "", "4.3.2", 2, "4.3"),
        ("Other Adjustments", "", "4.3.3", 2, "4.3"),
        ("5000 - Expenses(Cost of goods)", "Account 5000-5999", "5", 0, null),
        ("Expenses Classified By Nature", "Account 5100-5199", "5.1", 1, "5"),
        ("Material And Merchandise", "", "5.1.1", 2, "5.1"),
        ("Employee Benefits", "", "5.1.2", 2, "5.1"),
        ("Services", "", "5.1.3", 2, "5.1"),
        ("Rent, Depreciation, Amortization And Depletion", "", "5.1.4", 2, "5.1"),
        ("Expenses Classified By Function", "Account 5200-5299", "5.2", 1, "5"),
        ("Cost Of Sales", "", "5.2.1", 2, "5.2"),
        ("Selling, General And Administrative", "", "5.2.2", 2, "5.2"),
        ("Uncollectible Accounts Expense", "", "5.2.3", 2, "5.2"),
        ("6000 - Other (Non-Operating) Income And Expenses", "Account 6000-6999", "6", 0, null),
        ("Other Revenue And Expenses", "Account 6100-6199", "6.1", 1, "6"),
        ("Other Revenue", "", "6.1.1", 2, "6.1"),
        ("Other Expenses", "", "6.1.2", 2, "6.1"),
        ("Gains And Losses", "Account 6200-6299", "6.2", 1, "6"),
        ("Foreign Currency Transaction Gain (Loss)", "", "6.2.1", 2, "6.2"),
        ("Gain (Loss) On Investments", "", "6.2.2", 2, "6.2"),
        ("Gain (Loss) On Derivatives", "", "6.2.3", 2, "6.2"),
        ("Gain (Loss) On Disposal Of Assets", "", "6.2.4", 2, "6.2"),
        ("Debt Related Gain (Loss)", "", "6.2.5", 2, "6.2"),
        ("Impairment Loss", "", "6.2.6", 2, "6.2"),
        ("Other Gains And (Losses)", "", "6.2.7", 2, "6.2"),
        ("Taxes (Other Than Income And Payroll) And Fees", "Account 6300-6399", "6.3", 1, "6"),
        ("Real Estate Taxes And Insurance", "", "6.3.1", 2, "6.3"),
        ("Highway (Road) Taxes And Tolls", "", "6.3.2", 2, "6.3"),
        ("Direct Tax And License Fees", "", "6.3.3", 2, "6.3"),
        ("Excise And Sales Taxes", "", "6.3.4", 2, "6.3"),
        ("Customs Fees And Duties (Not Classified As Sales Or Excise)", "", "6.3.5", 2, "6.3"),
        ("Non-Deductible VAT (GST)", "", "6.3.6", 2, "6.3"),
        ("General Insurance Expense", "", "6.3.7", 2, "6.3"),
        ("Administrative Fees (Revenue Stamps)", "", "6.3.8", 2, "6.3"),
        ("Fines And Penalties", "", "6.3.9", 2, "6.3"),
        ("Miscellaneous Taxes", "", "6.3.10", 2, "6.3"),
        ("Other Taxes And Fees", "", "6.3.11", 2, "6.3"),
        ("Income Tax Expense (Benefit)", "Account 6400-6499", "6.4", 1, "6"),
        ("7000 - Intercompany And Related Party Accounts", "Account 7000-7999", "7", 0, null),
        ("Intercompany And Related Party Assets", "Account 7100-7199", "7.1", 1, "7"),
        ("Intercompany Balances (Eliminated In Consolidation)", "", "7.1.1", 2, "7.1"),
        ("Related Party Balances (Reported Or Disclosed)", "", "7.1.2", 2, "7.1"),
        ("Intercompany Investments", "", "7.1.3", 2, "7.1"),
        ("Intercompany And Related Party Liabilities", "Account 7200-7299", "7.2", 1, "7"),
        ("Intercompany Balances (Eliminated In Consolidation)", "", "7.2.1", 2, "7.2"),
        ("Related Party Balances (Reported Or Disclosed)", "", "7.2.2", 2, "7.2"),
        ("Intercompany And Related Party Income And Expense", "Account 7300-7399", "7.3", 1, "7"),
        ("Intercompany And Related Party Income", "", "7.3.1", 2, "7.3"),
        ("Intercompany And Related Party Expenses", "", "7.3.2", 2, "7.3"),
        ("Income (Loss) From Equity Method Investments", "", "7.3.3", 2, "7.3"),
    ];
}
