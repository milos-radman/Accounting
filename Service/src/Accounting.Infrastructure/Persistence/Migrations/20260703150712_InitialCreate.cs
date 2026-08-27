using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Accounting.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: "accounting");

            migrationBuilder.CreateTable(
                name: "AccountingClasses",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(
                        type: "nvarchar(20)",
                        maxLength: 20,
                        nullable: false
                    ),
                    Name = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountingClasses", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "AccountingEvents",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(
                        type: "nvarchar(20)",
                        maxLength: 20,
                        nullable: false
                    ),
                    Name = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: false
                    ),
                    Category = table.Column<int>(type: "int", nullable: false),
                    OriginalEventId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountingEvents", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "AccountingRules",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LegalEntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountingClassId = table.Column<Guid>(
                        type: "uniqueidentifier",
                        nullable: false
                    ),
                    LedgerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LedgerName = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    AccountingEventId = table.Column<Guid>(
                        type: "uniqueidentifier",
                        nullable: false
                    ),
                    FormulaId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Side = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountingRules", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "AmountTypes",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: false
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AmountTypes", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "ChartsOfAccount",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LegalEntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateName = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChartsOfAccount", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "ConditionAttributes",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConditionAttributes", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "Formulas",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(
                        type: "nvarchar(20)",
                        maxLength: 20,
                        nullable: false
                    ),
                    Name = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: false
                    ),
                    AmountTypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AmountTypeName = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    DebitAccountCode = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: true
                    ),
                    CreditAccountCode = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: true
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Formulas", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "Journals",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GliNumber = table.Column<long>(type: "bigint", nullable: false),
                    LegalEntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountingEventId = table.Column<Guid>(
                        type: "uniqueidentifier",
                        nullable: false
                    ),
                    AccountingEventCode = table.Column<string>(
                        type: "nvarchar(20)",
                        maxLength: 20,
                        nullable: false
                    ),
                    AccountingEventName = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    BookingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Currency = table.Column<string>(
                        type: "nvarchar(3)",
                        maxLength: 3,
                        nullable: false
                    ),
                    Origin = table.Column<int>(type: "int", nullable: false),
                    SourceMessageId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ExportedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Journals", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "Ledgers",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(
                        type: "nvarchar(20)",
                        maxLength: 20,
                        nullable: false
                    ),
                    Name = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ledgers", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "LegalEntities",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: false
                    ),
                    OwnerCode = table.Column<string>(
                        type: "nvarchar(20)",
                        maxLength: 20,
                        nullable: false
                    ),
                    OwnerName = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    BaseCurrency = table.Column<string>(
                        type: "nvarchar(3)",
                        maxLength: 3,
                        nullable: false
                    ),
                    Revaluation = table.Column<bool>(type: "bit", nullable: false),
                    GliNumberSerie = table.Column<long>(type: "bigint", nullable: false),
                    NextGliNumber = table.Column<long>(type: "bigint", nullable: false),
                    Responsible = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    OpenPeriod = table.Column<int>(type: "int", nullable: false),
                    ClosedPeriod = table.Column<int>(type: "int", nullable: false),
                    EndOfMonthPeriod = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LegalEntities", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "PseudoAccounts",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LegalEntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    ExternalCode = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    ExternalDescription = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    Revaluation = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PseudoAccounts", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "CoaNodes",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChartId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: false
                    ),
                    Order = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: false
                    ),
                    Depth = table.Column<int>(type: "int", nullable: false),
                    ParentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoaNodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CoaNodes_ChartsOfAccount_ChartId",
                        column: x => x.ChartId,
                        principalSchema: "accounting",
                        principalTable: "ChartsOfAccount",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "PseudoAccountPlacements",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChartId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PseudoAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoaNodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PseudoAccountPlacements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PseudoAccountPlacements_ChartsOfAccount_ChartId",
                        column: x => x.ChartId,
                        principalSchema: "accounting",
                        principalTable: "ChartsOfAccount",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "FormulaConditions",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FormulaId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Sequence = table.Column<int>(type: "int", nullable: false),
                    Level = table.Column<int>(type: "int", nullable: false),
                    AttributeName = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    Value = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    DebitAccountCode = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: true
                    ),
                    CreditAccountCode = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: true
                    ),
                    Operator = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormulaConditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormulaConditions_Formulas_FormulaId",
                        column: x => x.FormulaId,
                        principalSchema: "accounting",
                        principalTable: "Formulas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "JournalLines",
                schema: "accounting",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    JournalId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LineNumber = table.Column<int>(type: "int", nullable: false),
                    PseudoAccountCode = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: false
                    ),
                    LedgerName = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    Debit = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: false
                    ),
                    Credit = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: false
                    ),
                    Agreement = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: true
                    ),
                    AgreementLine = table.Column<int>(type: "int", nullable: true),
                    InvoiceNumber = table.Column<string>(
                        type: "nvarchar(50)",
                        maxLength: 50,
                        nullable: true
                    ),
                    FormulaCode = table.Column<string>(
                        type: "nvarchar(20)",
                        maxLength: 20,
                        nullable: true
                    ),
                    AmountTypeName = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ResolutionTrace = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: true
                    ),
                    ExternalAccount = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: true
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    UpdatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    UpdatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: true
                    ),
                    ShardKey = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    RowVersion = table.Column<byte[]>(
                        type: "rowversion",
                        rowVersion: true,
                        nullable: false
                    ),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JournalLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JournalLines_Journals_JournalId",
                        column: x => x.JournalId,
                        principalSchema: "accounting",
                        principalTable: "Journals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_AccountingClasses_Code",
                schema: "accounting",
                table: "AccountingClasses",
                column: "Code",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_AccountingClasses_ShardKey",
                schema: "accounting",
                table: "AccountingClasses",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_AccountingEvents_Code",
                schema: "accounting",
                table: "AccountingEvents",
                column: "Code",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_AccountingEvents_ShardKey",
                schema: "accounting",
                table: "AccountingEvents",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_AccountingRules_LegalEntityId_AccountingClassId_AccountingEventId",
                schema: "accounting",
                table: "AccountingRules",
                columns: new[] { "LegalEntityId", "AccountingClassId", "AccountingEventId" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_AccountingRules_ShardKey",
                schema: "accounting",
                table: "AccountingRules",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_AmountTypes_Name",
                schema: "accounting",
                table: "AmountTypes",
                column: "Name",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_AmountTypes_ShardKey",
                schema: "accounting",
                table: "AmountTypes",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_ChartsOfAccount_LegalEntityId",
                schema: "accounting",
                table: "ChartsOfAccount",
                column: "LegalEntityId",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_ChartsOfAccount_ShardKey",
                schema: "accounting",
                table: "ChartsOfAccount",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_CoaNodes_ChartId_Order",
                schema: "accounting",
                table: "CoaNodes",
                columns: new[] { "ChartId", "Order" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_CoaNodes_ShardKey",
                schema: "accounting",
                table: "CoaNodes",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_ConditionAttributes_Name",
                schema: "accounting",
                table: "ConditionAttributes",
                column: "Name",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_ConditionAttributes_ShardKey",
                schema: "accounting",
                table: "ConditionAttributes",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_FormulaConditions_FormulaId_Sequence",
                schema: "accounting",
                table: "FormulaConditions",
                columns: new[] { "FormulaId", "Sequence" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_FormulaConditions_ShardKey",
                schema: "accounting",
                table: "FormulaConditions",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Formulas_ShardKey",
                schema: "accounting",
                table: "Formulas",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_JournalLines_JournalId_LineNumber",
                schema: "accounting",
                table: "JournalLines",
                columns: new[] { "JournalId", "LineNumber" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_JournalLines_ShardKey",
                schema: "accounting",
                table: "JournalLines",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Journals_LegalEntityId_GliNumber",
                schema: "accounting",
                table: "Journals",
                columns: new[] { "LegalEntityId", "GliNumber" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_Journals_ShardKey",
                schema: "accounting",
                table: "Journals",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Journals_SourceMessageId",
                schema: "accounting",
                table: "Journals",
                column: "SourceMessageId",
                unique: true,
                filter: "[SourceMessageId] IS NOT NULL"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Ledgers_Code",
                schema: "accounting",
                table: "Ledgers",
                column: "Code",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_Ledgers_ShardKey",
                schema: "accounting",
                table: "Ledgers",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_LegalEntities_OwnerCode",
                schema: "accounting",
                table: "LegalEntities",
                column: "OwnerCode"
            );

            migrationBuilder.CreateIndex(
                name: "IX_LegalEntities_ShardKey",
                schema: "accounting",
                table: "LegalEntities",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_PseudoAccountPlacements_ChartId_PseudoAccountId",
                schema: "accounting",
                table: "PseudoAccountPlacements",
                columns: new[] { "ChartId", "PseudoAccountId" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_PseudoAccountPlacements_ShardKey",
                schema: "accounting",
                table: "PseudoAccountPlacements",
                column: "ShardKey"
            );

            migrationBuilder.CreateIndex(
                name: "IX_PseudoAccounts_LegalEntityId_Code",
                schema: "accounting",
                table: "PseudoAccounts",
                columns: new[] { "LegalEntityId", "Code" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_PseudoAccounts_ShardKey",
                schema: "accounting",
                table: "PseudoAccounts",
                column: "ShardKey"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AccountingClasses", schema: "accounting");

            migrationBuilder.DropTable(name: "AccountingEvents", schema: "accounting");

            migrationBuilder.DropTable(name: "AccountingRules", schema: "accounting");

            migrationBuilder.DropTable(name: "AmountTypes", schema: "accounting");

            migrationBuilder.DropTable(name: "CoaNodes", schema: "accounting");

            migrationBuilder.DropTable(name: "ConditionAttributes", schema: "accounting");

            migrationBuilder.DropTable(name: "FormulaConditions", schema: "accounting");

            migrationBuilder.DropTable(name: "JournalLines", schema: "accounting");

            migrationBuilder.DropTable(name: "Ledgers", schema: "accounting");

            migrationBuilder.DropTable(name: "LegalEntities", schema: "accounting");

            migrationBuilder.DropTable(name: "PseudoAccountPlacements", schema: "accounting");

            migrationBuilder.DropTable(name: "PseudoAccounts", schema: "accounting");

            migrationBuilder.DropTable(name: "Formulas", schema: "accounting");

            migrationBuilder.DropTable(name: "Journals", schema: "accounting");

            migrationBuilder.DropTable(name: "ChartsOfAccount", schema: "accounting");
        }
    }
}
