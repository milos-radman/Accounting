using Accounting.Domain.Configuration;
using Accounting.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Accounting.Infrastructure.Seeding;

/// <summary>
/// Seeds the reference data from the accounting configuration workbook into a tenant
/// database on first use. Idempotent: inserts only what is missing (matched on code/name).
/// Ids are deterministic so all tenant databases share the same reference-data ids.
/// </summary>
public static class ReferenceDataSeeder
{
    /// <summary>Deterministic id derived from a fixed namespace + discriminator.</summary>
    private static Guid Id(string discriminator)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes("accounting-refdata:" + discriminator)
        );
        var bytes = hash[..16];
        bytes[7] = (byte)((bytes[7] & 0x0F) | 0x40); // version 4 layout
        bytes[8] = (byte)((bytes[8] & 0x3F) | 0x80);
        return new Guid(bytes);
    }

    public static async Task SeedAsync(
        AccountingDbContext context,
        CancellationToken cancellationToken = default
    )
    {
        await SeedSet(
            context,
            [
                AccountingClass.Create(
                    Id("class:PF"),
                    "PF",
                    "PF-Agreement",
                    "Asset financing agreements"
                ),
                AccountingClass.Create(
                    Id("class:AR-Inv"),
                    "AR-Inv",
                    "AR Invoicing",
                    "Receivables - Invoicing"
                ),
                AccountingClass.Create(
                    Id("class:AR-Pay"),
                    "AR-Pay",
                    "AR Payment",
                    "Receivables - Customer Payments"
                ),
                AccountingClass.Create(
                    Id("class:AP-Inv"),
                    "AP-Inv",
                    "AP Invoicing",
                    "Payables - Invoicing"
                ),
                AccountingClass.Create(
                    Id("class:AP-Pay"),
                    "AP-Pay",
                    "AP Payment",
                    "Payables - Payments"
                ),
            ],
            (set, item) => set.AnyAsync(x => x.Code == item.Code, cancellationToken),
            cancellationToken
        );

        await SeedSet(
            context,
            [
                Ledger.Create(Id("ledger:LL"), "LL", "Local Legal", "Local Legal"),
                Ledger.Create(Id("ledger:US"), "US", "US GAAP", "US GAAP"),
                Ledger.Create(Id("ledger:CO"), "CO", "Common", "Common"),
            ],
            (set, item) => set.AnyAsync(x => x.Code == item.Code, cancellationToken),
            cancellationToken
        );

        var events = new[]
        {
            (
                "s",
                "Activation",
                "Activation accounting of the agreement",
                EventCategory.Normal,
                (string?)null
            ),
            ("i", "Invoicing", "Invoicing bookings for a contract", EventCategory.Normal, null),
            ("cp", "AR Payment", "Customer payment bookings", EventCategory.Normal, null),
            ("si", "Termination Invoicing", "Termination invoicing", EventCategory.Normal, null),
            ("ta", "Termination Asset", "Termination of an agreement", EventCategory.Normal, null),
            (
                "wo",
                "Write Off",
                "Write off a whole invoice or parts of it",
                EventCategory.Normal,
                null
            ),
            (
                "mi",
                "Manual Invoice",
                "Invoicing not connected to an agreement",
                EventCategory.Normal,
                null
            ),
            ("us", "Undo Activation", "Reverse activation bookings", EventCategory.Reversal, "s"),
            ("ic", "Credit Invoicing", "Reverse invoice bookings", EventCategory.Reversal, "i"),
            (
                "man",
                "Manual Transaction",
                "Manual transactions within accounting",
                EventCategory.Normal,
                null
            ),
            ("m", "Monthly Booking", "Monthly bookings for a contract", EventCategory.Normal, null),
            (
                "md",
                "Monthly Booking Reversal",
                "Reverses previous month accruals",
                EventCategory.Reversal,
                "m"
            ),
        };
        await SeedSet(
            context,
            events
                .Select(e =>
                    AccountingEvent.Create(
                        Id("event:" + e.Item1),
                        e.Item1,
                        e.Item2,
                        e.Item3,
                        e.Item4,
                        e.Item5 is null ? null : Id("event:" + e.Item5)
                    )
                )
                .ToArray(),
            (set, item) => set.AnyAsync(x => x.Code == item.Code, cancellationToken),
            cancellationToken
        );

        var amountTypes = new[]
        {
            ("Fixed Asset Value", "The fixed asset value from the agreement line"),
            ("Residual Value", "Residual value at agreement line end date"),
            ("Deposit", "Deposit from agreement line"),
            ("Total Plan Rent", "Sum of all period rents over the agreement line"),
            ("Total Plan Amortization", "Sum of all period amortizations over the agreement line"),
            ("Total Plan Interest", "Sum of all period interests over the agreement line"),
            ("Total Amount", "Invoice total from the agreement/invoice line"),
            ("Amortization", "Invoice amortization from the agreement/invoice line"),
            ("Interest", "Invoice interest from the agreement/invoice line"),
            ("Added Cost", "Invoice/payment added cost"),
            ("Tax", "Invoice tax from the agreement/invoice line"),
            ("Rounding", "Decimal adjustment from the invoice"),
            ("Rent", "Invoice rent (amortization + interest)"),
            ("Rent - Primary", "Invoice rent, primary period only"),
            ("On Account - Customer", "On account placed on a customer"),
            ("On Account - Agreement", "On account placed on an agreement"),
            ("Unallocated Amount", "Paid amount that is unallocated"),
            ("Settlement Value", "Chosen settlement value in settlement calculation"),
            ("Remaining Current Rent", "Remaining contract rent, next 12 months"),
            ("Remaining Non Current Rent", "Remaining contract rent, month 13 to end"),
            ("Remaining Current Interest", "Remaining interest, next 12 months"),
            ("Remaining Non Current Interest", "Remaining interest, month 13 to end"),
            ("Purchase Option Amount", "Purchase option amount at contract end"),
            ("Profit", "Profit from a settlement calculation"),
            ("Loss", "Loss from a settlement calculation"),
            ("Invoice Net Amount", "Invoice net amount"),
            ("Monthly Depreciation", "Monthly depreciation from the recognition table"),
            ("Monthly Interest", "Monthly interest from the recognition table"),
        };
        await SeedSet(
            context,
            amountTypes
                .Select(a => AmountType.Create(Id("amount:" + a.Item1), a.Item1, a.Item2))
                .ToArray(),
            (set, item) => set.AnyAsync(x => x.Name == item.Name, cancellationToken),
            cancellationToken
        );

        var attributes = new[]
        {
            "Accounting Type",
            "Product",
            "Portfolio",
            "Customer",
            "Supplier",
            "Agreement",
            "Invoice Type",
            "Currency Code",
            "Term Reason",
            "Amount Code",
            "Payment Method",
            "VAT Name",
        };
        await SeedSet(
            context,
            attributes.Select(a => ConditionAttribute.Create(Id("attr:" + a), a)).ToArray(),
            (set, item) => set.AnyAsync(x => x.Name == item.Name, cancellationToken),
            cancellationToken
        );

        await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task SeedSet<T>(
        AccountingDbContext context,
        IReadOnlyList<T> items,
        Func<DbSet<T>, T, Task<bool>> exists,
        CancellationToken cancellationToken
    )
        where T : class
    {
        _ = cancellationToken;
        var set = context.Set<T>();
        foreach (var item in items)
        {
            if (!await exists(set, item))
            {
                set.Add(item);
            }
        }
    }
}
