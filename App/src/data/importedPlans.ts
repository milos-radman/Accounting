import type { RecognitionPlan } from '../types';

// Agreements imported from the old system (PF_MonthlyRec.xlsx): historical, read-only recognition
// tables with Booked-To (accounting month) and Invoiced-To (billing-period index) watermarks — kept
// in their own units because billing periods can be broken (not calendar months). Amortization +
// Interest are the earned rent split; depreciation is only carried when the type is Annuity.
export const importedPlans: RecognitionPlan[] = [
 {
  "id": 100,
  "legalEntityId": 1,
  "entityCode": "ALS NLD",
  "agreement": "1139",
  "agreementDescription": "Ponsse Beaver",
  "customer": "AB Construction Consult",
  "currency": "EUR",
  "classification": "Finance",
  "status": "Active",
  "receivedDate": "2020-12-01",
  "source": "Old system import (PF_MonthlyRec)",
  "sourceGli": null,
  "imported": true,
  "lines": [
   {
    "agreementLine": 1,
    "assetDescription": "Ponsse Beaver",
    "schedule": [],
    "imported": {
     "bookedToPeriod": "202311",
     "invoicedToPeriod": 28,
     "depreciationType": "Annuity",
     "rows": [
      {
       "period": "202110",
       "invoicingPeriod": 1,
       "amortization": 60309.69,
       "interest": 5751.21,
       "depreciation": 60309.69
      },
      {
       "period": "202111",
       "invoicingPeriod": 2,
       "amortization": 60416.79,
       "interest": 5458.59,
       "depreciation": 60416.79
      },
      {
       "period": "202112",
       "invoicingPeriod": 3,
       "amortization": 60524.08,
       "interest": 5529.68,
       "depreciation": 60524.08
      },
      {
       "period": "202201",
       "invoicingPeriod": 4,
       "amortization": 60631.56,
       "interest": 5418.61,
       "depreciation": 60631.56
      },
      {
       "period": "202202",
       "invoicingPeriod": 5,
       "amortization": 60739.23,
       "interest": 4793.74,
       "depreciation": 60739.23
      },
      {
       "period": "202203",
       "invoicingPeriod": 6,
       "amortization": 60847.1,
       "interest": 5195.89,
       "depreciation": 60847.1
      },
      {
       "period": "202204",
       "invoicingPeriod": 7,
       "amortization": 60955.15,
       "interest": 4920.23,
       "depreciation": 60955.15
      },
      {
       "period": "202205",
       "invoicingPeriod": 8,
       "amortization": 61063.4,
       "interest": 4972.38,
       "depreciation": 61063.4
      },
      {
       "period": "202206",
       "invoicingPeriod": 9,
       "amortization": 61171.84,
       "interest": 4703.54,
       "depreciation": 61171.84
      },
      {
       "period": "202207",
       "invoicingPeriod": 10,
       "amortization": 61280.47,
       "interest": 4748.08,
       "depreciation": 61280.47
      },
      {
       "period": "202208",
       "invoicingPeriod": 11,
       "amortization": 61389.29,
       "interest": 4635.63,
       "depreciation": 61389.29
      },
      {
       "period": "202209",
       "invoicingPeriod": 12,
       "amortization": 61498.31,
       "interest": 4377.07,
       "depreciation": 61498.31
      },
      {
       "period": "202210",
       "invoicingPeriod": 13,
       "amortization": 61607.52,
       "interest": 4410.12,
       "depreciation": 61607.52
      },
      {
       "period": "202211",
       "invoicingPeriod": 14,
       "amortization": 61716.92,
       "interest": 4158.46,
       "depreciation": 61716.92
      },
      {
       "period": "202212",
       "invoicingPeriod": 15,
       "amortization": 61826.52,
       "interest": 4183.82,
       "depreciation": 61826.52
      },
      {
       "period": "202301",
       "invoicingPeriod": 16,
       "amortization": 61936.32,
       "interest": 4070.37,
       "depreciation": 61936.32
      },
      {
       "period": "202302",
       "invoicingPeriod": 17,
       "amortization": 62046.3,
       "interest": 3573.8,
       "depreciation": 62046.3
      },
      {
       "period": "202303",
       "invoicingPeriod": 18,
       "amortization": 62156.49,
       "interest": 3842.85,
       "depreciation": 62156.49
      },
      {
       "period": "202304",
       "invoicingPeriod": 19,
       "amortization": 62266.87,
       "interest": 3608.51,
       "depreciation": 62266.87
      },
      {
       "period": "202305",
       "invoicingPeriod": 20,
       "amortization": 62377.44,
       "interest": 3614.53,
       "depreciation": 62377.44
      },
      {
       "period": "202306",
       "invoicingPeriod": 21,
       "amortization": 62488.22,
       "interest": 3387.16,
       "depreciation": 62488.22
      },
      {
       "period": "202307",
       "invoicingPeriod": 22,
       "amortization": 62599.19,
       "interest": 3385.4,
       "depreciation": 62599.19
      },
      {
       "period": "202308",
       "invoicingPeriod": 23,
       "amortization": 62710.35,
       "interest": 3270.53,
       "depreciation": 62710.35
      },
      {
       "period": "202309",
       "invoicingPeriod": 24,
       "amortization": 62821.71,
       "interest": 3053.67,
       "depreciation": 62821.71
      },
      {
       "period": "202310",
       "invoicingPeriod": 25,
       "amortization": 62933.28,
       "interest": 3040.17,
       "depreciation": 62933.28
      },
      {
       "period": "202311",
       "invoicingPeriod": 26,
       "amortization": 63045.03,
       "interest": 2830.35,
       "depreciation": 63045.03
      },
      {
       "period": "202312",
       "invoicingPeriod": 27,
       "amortization": 63156.99,
       "interest": 2809,
       "depreciation": 63156.99
      },
      {
       "period": "202401",
       "invoicingPeriod": 28,
       "amortization": 63269.15,
       "interest": 2693.11,
       "depreciation": 63269.15
      },
      {
       "period": "202402",
       "invoicingPeriod": 29,
       "amortization": 63381.5,
       "interest": 2410.75,
       "depreciation": 63381.5
      },
      {
       "period": "202403",
       "invoicingPeriod": 30,
       "amortization": 63494.06,
       "interest": 2460.7,
       "depreciation": 63494.06
      },
      {
       "period": "202404",
       "invoicingPeriod": 31,
       "amortization": 63606.81,
       "interest": 2268.57,
       "depreciation": 63606.81
      },
      {
       "period": "202405",
       "invoicingPeriod": 32,
       "amortization": 63719.77,
       "interest": 2227.46,
       "depreciation": 63719.77
      },
      {
       "period": "202406",
       "invoicingPeriod": 33,
       "amortization": 63832.93,
       "interest": 2042.45,
       "depreciation": 63832.93
      },
      {
       "period": "202407",
       "invoicingPeriod": 34,
       "amortization": 63946.28,
       "interest": 1993.4,
       "depreciation": 63946.28
      },
      {
       "period": "202408",
       "invoicingPeriod": 35,
       "amortization": 64059.84,
       "interest": 1876.06,
       "depreciation": 64059.84
      },
      {
       "period": "202409",
       "invoicingPeriod": 36,
       "amortization": 64173.6,
       "interest": 1701.78,
       "depreciation": 64173.6
      }
     ]
    }
   }
  ]
 },
 {
  "id": 101,
  "legalEntityId": 1,
  "entityCode": "ALS NLD",
  "agreement": "4002",
  "agreementDescription": "Toyota RAV4 Laddhybrid",
  "customer": "Kajsa Systemkonsult AB",
  "currency": "SEK",
  "classification": "Finance",
  "status": "Active",
  "receivedDate": "2020-12-01",
  "source": "Old system import (PF_MonthlyRec)",
  "sourceGli": null,
  "imported": true,
  "lines": [
   {
    "agreementLine": 1,
    "assetDescription": "Toyota RAV4 Laddhybrid",
    "schedule": [],
    "imported": {
     "bookedToPeriod": "202311",
     "invoicedToPeriod": 36,
     "depreciationType": "Annuity",
     "rows": [
      {
       "period": "202102",
       "invoicingPeriod": 1,
       "amortization": 7173.7,
       "interest": 1271.68,
       "depreciation": 7173.7
      },
      {
       "period": "202103",
       "invoicingPeriod": 2,
       "amortization": 7194.23,
       "interest": 1251.15,
       "depreciation": 7194.23
      },
      {
       "period": "202104",
       "invoicingPeriod": 3,
       "amortization": 7214.83,
       "interest": 1230.55,
       "depreciation": 7214.83
      },
      {
       "period": "202105",
       "invoicingPeriod": 4,
       "amortization": 7235.48,
       "interest": 1209.9,
       "depreciation": 7235.48
      },
      {
       "period": "202106",
       "invoicingPeriod": 5,
       "amortization": 7256.19,
       "interest": 1189.19,
       "depreciation": 7256.19
      },
      {
       "period": "202107",
       "invoicingPeriod": 6,
       "amortization": 7276.96,
       "interest": 1168.42,
       "depreciation": 7276.96
      },
      {
       "period": "202108",
       "invoicingPeriod": 7,
       "amortization": 7297.79,
       "interest": 1147.59,
       "depreciation": 7297.79
      },
      {
       "period": "202109",
       "invoicingPeriod": 8,
       "amortization": 7318.68,
       "interest": 1126.7,
       "depreciation": 7318.68
      },
      {
       "period": "202110",
       "invoicingPeriod": 9,
       "amortization": 7339.63,
       "interest": 1105.75,
       "depreciation": 7339.63
      },
      {
       "period": "202111",
       "invoicingPeriod": 10,
       "amortization": 7360.64,
       "interest": 1084.74,
       "depreciation": 7360.64
      },
      {
       "period": "202112",
       "invoicingPeriod": 11,
       "amortization": 7381.71,
       "interest": 1063.67,
       "depreciation": 7381.71
      },
      {
       "period": "202201",
       "invoicingPeriod": 12,
       "amortization": 7402.84,
       "interest": 1042.54,
       "depreciation": 7402.84
      },
      {
       "period": "202202",
       "invoicingPeriod": 13,
       "amortization": 7424.03,
       "interest": 1021.35,
       "depreciation": 7424.03
      },
      {
       "period": "202203",
       "invoicingPeriod": 14,
       "amortization": 7445.28,
       "interest": 1000.1,
       "depreciation": 7445.28
      },
      {
       "period": "202204",
       "invoicingPeriod": 15,
       "amortization": 7466.6,
       "interest": 978.78,
       "depreciation": 7466.6
      },
      {
       "period": "202205",
       "invoicingPeriod": 16,
       "amortization": 7487.97,
       "interest": 957.41,
       "depreciation": 7487.97
      },
      {
       "period": "202206",
       "invoicingPeriod": 17,
       "amortization": 7509.4,
       "interest": 935.98,
       "depreciation": 7509.4
      },
      {
       "period": "202207",
       "invoicingPeriod": 18,
       "amortization": 7530.9,
       "interest": 914.48,
       "depreciation": 7530.9
      },
      {
       "period": "202208",
       "invoicingPeriod": 19,
       "amortization": 7552.46,
       "interest": 892.92,
       "depreciation": 7552.46
      },
      {
       "period": "202209",
       "invoicingPeriod": 20,
       "amortization": 7574.08,
       "interest": 871.3,
       "depreciation": 7574.08
      },
      {
       "period": "202210",
       "invoicingPeriod": 21,
       "amortization": 7595.76,
       "interest": 849.62,
       "depreciation": 7595.76
      },
      {
       "period": "202211",
       "invoicingPeriod": 22,
       "amortization": 7617.5,
       "interest": 827.88,
       "depreciation": 7617.5
      },
      {
       "period": "202212",
       "invoicingPeriod": 23,
       "amortization": 7639.31,
       "interest": 806.07,
       "depreciation": 7639.31
      },
      {
       "period": "202301",
       "invoicingPeriod": 24,
       "amortization": 7661.17,
       "interest": 784.21,
       "depreciation": 7661.17
      },
      {
       "period": "202302",
       "invoicingPeriod": 25,
       "amortization": 7683.1,
       "interest": 762.28,
       "depreciation": 7683.1
      },
      {
       "period": "202303",
       "invoicingPeriod": 26,
       "amortization": 7705.1,
       "interest": 740.28,
       "depreciation": 7705.1
      },
      {
       "period": "202304",
       "invoicingPeriod": 27,
       "amortization": 7727.15,
       "interest": 718.23,
       "depreciation": 7727.15
      },
      {
       "period": "202305",
       "invoicingPeriod": 28,
       "amortization": 7749.27,
       "interest": 696.11,
       "depreciation": 7749.27
      },
      {
       "period": "202306",
       "invoicingPeriod": 29,
       "amortization": 7771.45,
       "interest": 673.93,
       "depreciation": 7771.45
      },
      {
       "period": "202307",
       "invoicingPeriod": 30,
       "amortization": 7793.7,
       "interest": 651.68,
       "depreciation": 7793.7
      },
      {
       "period": "202308",
       "invoicingPeriod": 31,
       "amortization": 7816.01,
       "interest": 629.37,
       "depreciation": 7816.01
      },
      {
       "period": "202309",
       "invoicingPeriod": 32,
       "amortization": 7838.38,
       "interest": 607,
       "depreciation": 7838.38
      },
      {
       "period": "202310",
       "invoicingPeriod": 33,
       "amortization": 7860.82,
       "interest": 584.56,
       "depreciation": 7860.82
      },
      {
       "period": "202311",
       "invoicingPeriod": 34,
       "amortization": 7883.32,
       "interest": 562.06,
       "depreciation": 7883.32
      },
      {
       "period": "202312",
       "invoicingPeriod": 35,
       "amortization": 7905.89,
       "interest": 539.49,
       "depreciation": 7905.89
      },
      {
       "period": "202401",
       "invoicingPeriod": 36,
       "amortization": 7928.67,
       "interest": 516.71,
       "depreciation": 7928.67
      },
      {
       "period": "202402",
       "invoicingPeriod": 37,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202403",
       "invoicingPeriod": 38,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202404",
       "invoicingPeriod": 39,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202405",
       "invoicingPeriod": 40,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202406",
       "invoicingPeriod": 41,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202407",
       "invoicingPeriod": 42,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202408",
       "invoicingPeriod": 43,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202409",
       "invoicingPeriod": 44,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202410",
       "invoicingPeriod": 45,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202411",
       "invoicingPeriod": 46,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202412",
       "invoicingPeriod": 47,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202501",
       "invoicingPeriod": 48,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202502",
       "invoicingPeriod": 49,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202503",
       "invoicingPeriod": 50,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202504",
       "invoicingPeriod": 51,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202505",
       "invoicingPeriod": 52,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202506",
       "invoicingPeriod": 53,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202507",
       "invoicingPeriod": 54,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202508",
       "invoicingPeriod": 55,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202509",
       "invoicingPeriod": 56,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202510",
       "invoicingPeriod": 57,
       "amortization": 8445.38,
       "interest": 0,
       "depreciation": 8445.38
      },
      {
       "period": "202511",
       "invoicingPeriod": 58,
       "amortization": 3727.02,
       "interest": 4718.36,
       "depreciation": 3727.02
      },
      {
       "period": "202512",
       "invoicingPeriod": 59,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202601",
       "invoicingPeriod": 60,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202602",
       "invoicingPeriod": 61,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202603",
       "invoicingPeriod": 62,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202604",
       "invoicingPeriod": 63,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202605",
       "invoicingPeriod": 64,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202606",
       "invoicingPeriod": 65,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202607",
       "invoicingPeriod": 66,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202608",
       "invoicingPeriod": 67,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202609",
       "invoicingPeriod": 68,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202610",
       "invoicingPeriod": 69,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202611",
       "invoicingPeriod": 70,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202612",
       "invoicingPeriod": 71,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202701",
       "invoicingPeriod": 72,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202702",
       "invoicingPeriod": 73,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202703",
       "invoicingPeriod": 74,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202704",
       "invoicingPeriod": 75,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202705",
       "invoicingPeriod": 76,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202706",
       "invoicingPeriod": 77,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202707",
       "invoicingPeriod": 78,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202708",
       "invoicingPeriod": 79,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202709",
       "invoicingPeriod": 80,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202710",
       "invoicingPeriod": 81,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202711",
       "invoicingPeriod": 82,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202712",
       "invoicingPeriod": 83,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202801",
       "invoicingPeriod": 84,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202802",
       "invoicingPeriod": 85,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202803",
       "invoicingPeriod": 86,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202804",
       "invoicingPeriod": 87,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202805",
       "invoicingPeriod": 88,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202806",
       "invoicingPeriod": 89,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202807",
       "invoicingPeriod": 90,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202808",
       "invoicingPeriod": 91,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202809",
       "invoicingPeriod": 92,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202810",
       "invoicingPeriod": 93,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202811",
       "invoicingPeriod": 94,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202812",
       "invoicingPeriod": 95,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      },
      {
       "period": "202901",
       "invoicingPeriod": 96,
       "amortization": 0,
       "interest": 8445.38,
       "depreciation": 0
      }
     ]
    }
   }
  ]
 },
 {
  "id": 102,
  "legalEntityId": 1,
  "entityCode": "ALS NLD",
  "agreement": "4003",
  "agreementDescription": "Toyota Yaris Hybrid",
  "customer": "Kajsa ordning & reda",
  "currency": "SEK",
  "classification": "Finance",
  "status": "Active",
  "receivedDate": "2020-12-01",
  "source": "Old system import (PF_MonthlyRec)",
  "sourceGli": null,
  "imported": true,
  "lines": [
   {
    "agreementLine": 1,
    "assetDescription": "Toyota",
    "schedule": [],
    "imported": {
     "bookedToPeriod": "202311",
     "invoicedToPeriod": 36,
     "depreciationType": "Annuity",
     "rows": [
      {
       "period": "202102",
       "invoicingPeriod": 1,
       "amortization": 2522.76,
       "interest": 447.21,
       "depreciation": 2522.76
      },
      {
       "period": "202103",
       "invoicingPeriod": 2,
       "amortization": 2529.98,
       "interest": 439.99,
       "depreciation": 2529.98
      },
      {
       "period": "202104",
       "invoicingPeriod": 3,
       "amortization": 2537.22,
       "interest": 432.75,
       "depreciation": 2537.22
      },
      {
       "period": "202105",
       "invoicingPeriod": 4,
       "amortization": 2544.48,
       "interest": 425.49,
       "depreciation": 2544.48
      },
      {
       "period": "202106",
       "invoicingPeriod": 5,
       "amortization": 2551.77,
       "interest": 418.2,
       "depreciation": 2551.77
      },
      {
       "period": "202107",
       "invoicingPeriod": 6,
       "amortization": 2559.07,
       "interest": 410.9,
       "depreciation": 2559.07
      },
      {
       "period": "202108",
       "invoicingPeriod": 7,
       "amortization": 2566.4,
       "interest": 403.57,
       "depreciation": 2566.4
      },
      {
       "period": "202109",
       "invoicingPeriod": 8,
       "amortization": 2573.74,
       "interest": 396.23,
       "depreciation": 2573.74
      },
      {
       "period": "202110",
       "invoicingPeriod": 9,
       "amortization": 2581.11,
       "interest": 388.86,
       "depreciation": 2581.11
      },
      {
       "period": "202111",
       "invoicingPeriod": 10,
       "amortization": 2588.5,
       "interest": 381.47,
       "depreciation": 2588.5
      },
      {
       "period": "202112",
       "invoicingPeriod": 11,
       "amortization": 2595.91,
       "interest": 374.06,
       "depreciation": 2595.91
      },
      {
       "period": "202201",
       "invoicingPeriod": 12,
       "amortization": 2603.34,
       "interest": 366.63,
       "depreciation": 2603.34
      },
      {
       "period": "202202",
       "invoicingPeriod": 13,
       "amortization": 2610.79,
       "interest": 359.18,
       "depreciation": 2610.79
      },
      {
       "period": "202203",
       "invoicingPeriod": 14,
       "amortization": 2618.26,
       "interest": 351.71,
       "depreciation": 2618.26
      },
      {
       "period": "202204",
       "invoicingPeriod": 15,
       "amortization": 2625.76,
       "interest": 344.21,
       "depreciation": 2625.76
      },
      {
       "period": "202205",
       "invoicingPeriod": 16,
       "amortization": 2633.28,
       "interest": 336.69,
       "depreciation": 2633.28
      },
      {
       "period": "202206",
       "invoicingPeriod": 17,
       "amortization": 2640.81,
       "interest": 329.16,
       "depreciation": 2640.81
      },
      {
       "period": "202207",
       "invoicingPeriod": 18,
       "amortization": 2648.37,
       "interest": 321.6,
       "depreciation": 2648.37
      },
      {
       "period": "202208",
       "invoicingPeriod": 19,
       "amortization": 2655.95,
       "interest": 314.02,
       "depreciation": 2655.95
      },
      {
       "period": "202209",
       "invoicingPeriod": 20,
       "amortization": 2663.56,
       "interest": 306.41,
       "depreciation": 2663.56
      },
      {
       "period": "202210",
       "invoicingPeriod": 21,
       "amortization": 2671.18,
       "interest": 298.79,
       "depreciation": 2671.18
      },
      {
       "period": "202211",
       "invoicingPeriod": 22,
       "amortization": 2678.83,
       "interest": 291.14,
       "depreciation": 2678.83
      },
      {
       "period": "202212",
       "invoicingPeriod": 23,
       "amortization": 2686.5,
       "interest": 283.47,
       "depreciation": 2686.5
      },
      {
       "period": "202301",
       "invoicingPeriod": 24,
       "amortization": 2694.19,
       "interest": 275.78,
       "depreciation": 2694.19
      },
      {
       "period": "202302",
       "invoicingPeriod": 25,
       "amortization": 2701.9,
       "interest": 268.07,
       "depreciation": 2701.9
      },
      {
       "period": "202303",
       "invoicingPeriod": 26,
       "amortization": 2709.63,
       "interest": 260.34,
       "depreciation": 2709.63
      },
      {
       "period": "202304",
       "invoicingPeriod": 27,
       "amortization": 2717.39,
       "interest": 252.58,
       "depreciation": 2717.39
      },
      {
       "period": "202305",
       "invoicingPeriod": 28,
       "amortization": 2725.17,
       "interest": 244.8,
       "depreciation": 2725.17
      },
      {
       "period": "202306",
       "invoicingPeriod": 29,
       "amortization": 2732.97,
       "interest": 237,
       "depreciation": 2732.97
      },
      {
       "period": "202307",
       "invoicingPeriod": 30,
       "amortization": 2740.79,
       "interest": 229.18,
       "depreciation": 2740.79
      },
      {
       "period": "202308",
       "invoicingPeriod": 31,
       "amortization": 2748.64,
       "interest": 221.33,
       "depreciation": 2748.64
      },
      {
       "period": "202309",
       "invoicingPeriod": 32,
       "amortization": 2756.51,
       "interest": 213.46,
       "depreciation": 2756.51
      },
      {
       "period": "202310",
       "invoicingPeriod": 33,
       "amortization": 2764.4,
       "interest": 205.57,
       "depreciation": 2764.4
      },
      {
       "period": "202311",
       "invoicingPeriod": 34,
       "amortization": 2772.31,
       "interest": 197.66,
       "depreciation": 2772.31
      },
      {
       "period": "202312",
       "invoicingPeriod": 35,
       "amortization": 2780.25,
       "interest": 189.72,
       "depreciation": 2780.25
      },
      {
       "period": "202401",
       "invoicingPeriod": 36,
       "amortization": 2788.28,
       "interest": 181.69,
       "depreciation": 2788.28
      },
      {
       "period": "202402",
       "invoicingPeriod": 37,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202403",
       "invoicingPeriod": 38,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202404",
       "invoicingPeriod": 39,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202405",
       "invoicingPeriod": 40,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202406",
       "invoicingPeriod": 41,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202407",
       "invoicingPeriod": 42,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202408",
       "invoicingPeriod": 43,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202409",
       "invoicingPeriod": 44,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202410",
       "invoicingPeriod": 45,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202411",
       "invoicingPeriod": 46,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202412",
       "invoicingPeriod": 47,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202501",
       "invoicingPeriod": 48,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202502",
       "invoicingPeriod": 49,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202503",
       "invoicingPeriod": 50,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202504",
       "invoicingPeriod": 51,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202505",
       "invoicingPeriod": 52,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202506",
       "invoicingPeriod": 53,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202507",
       "invoicingPeriod": 54,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202508",
       "invoicingPeriod": 55,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202509",
       "invoicingPeriod": 56,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202510",
       "invoicingPeriod": 57,
       "amortization": 2969.97,
       "interest": 0,
       "depreciation": 2969.97
      },
      {
       "period": "202511",
       "invoicingPeriod": 58,
       "amortization": 1310.63,
       "interest": 1659.34,
       "depreciation": 1310.63
      },
      {
       "period": "202512",
       "invoicingPeriod": 59,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202601",
       "invoicingPeriod": 60,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202602",
       "invoicingPeriod": 61,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202603",
       "invoicingPeriod": 62,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202604",
       "invoicingPeriod": 63,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202605",
       "invoicingPeriod": 64,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202606",
       "invoicingPeriod": 65,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202607",
       "invoicingPeriod": 66,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202608",
       "invoicingPeriod": 67,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202609",
       "invoicingPeriod": 68,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202610",
       "invoicingPeriod": 69,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202611",
       "invoicingPeriod": 70,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202612",
       "invoicingPeriod": 71,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202701",
       "invoicingPeriod": 72,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202702",
       "invoicingPeriod": 73,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202703",
       "invoicingPeriod": 74,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202704",
       "invoicingPeriod": 75,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202705",
       "invoicingPeriod": 76,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202706",
       "invoicingPeriod": 77,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202707",
       "invoicingPeriod": 78,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202708",
       "invoicingPeriod": 79,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202709",
       "invoicingPeriod": 80,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202710",
       "invoicingPeriod": 81,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202711",
       "invoicingPeriod": 82,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202712",
       "invoicingPeriod": 83,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202801",
       "invoicingPeriod": 84,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202802",
       "invoicingPeriod": 85,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202803",
       "invoicingPeriod": 86,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202804",
       "invoicingPeriod": 87,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202805",
       "invoicingPeriod": 88,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202806",
       "invoicingPeriod": 89,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202807",
       "invoicingPeriod": 90,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202808",
       "invoicingPeriod": 91,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202809",
       "invoicingPeriod": 92,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202810",
       "invoicingPeriod": 93,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202811",
       "invoicingPeriod": 94,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202812",
       "invoicingPeriod": 95,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      },
      {
       "period": "202901",
       "invoicingPeriod": 96,
       "amortization": 0,
       "interest": 2969.97,
       "depreciation": 0
      }
     ]
    }
   }
  ]
 },
 {
  "id": 103,
  "legalEntityId": 1,
  "entityCode": "ALS NLD",
  "agreement": "4010",
  "agreementDescription": "Volvo XC40 Recharge",
  "customer": "Kajsa Consult AB",
  "currency": "SEK",
  "classification": "Finance",
  "status": "Active",
  "receivedDate": "2020-12-01",
  "source": "Old system import (PF_MonthlyRec)",
  "sourceGli": null,
  "imported": true,
  "lines": [
   {
    "agreementLine": 1,
    "assetDescription": "Volvo XC40 Recharge",
    "schedule": [],
    "imported": {
     "bookedToPeriod": "202311",
     "invoicedToPeriod": 50,
     "depreciationType": "Annuity",
     "rows": [
      {
       "period": "202001",
       "invoicingPeriod": 1,
       "amortization": 108740.5,
       "interest": 1259.5,
       "depreciation": 108740.5
      },
      {
       "period": "202002",
       "invoicingPeriod": 2,
       "amortization": 6019.34,
       "interest": 1242.32,
       "depreciation": 6019.34
      },
      {
       "period": "202003",
       "invoicingPeriod": 3,
       "amortization": 6036.57,
       "interest": 1225.09,
       "depreciation": 6036.57
      },
      {
       "period": "202004",
       "invoicingPeriod": 4,
       "amortization": 6053.85,
       "interest": 1207.81,
       "depreciation": 6053.85
      },
      {
       "period": "202005",
       "invoicingPeriod": 5,
       "amortization": 6071.18,
       "interest": 1190.48,
       "depreciation": 6071.18
      },
      {
       "period": "202006",
       "invoicingPeriod": 6,
       "amortization": 6088.56,
       "interest": 1173.1,
       "depreciation": 6088.56
      },
      {
       "period": "202007",
       "invoicingPeriod": 7,
       "amortization": 6105.99,
       "interest": 1155.67,
       "depreciation": 6105.99
      },
      {
       "period": "202008",
       "invoicingPeriod": 8,
       "amortization": 6123.47,
       "interest": 1138.19,
       "depreciation": 6123.47
      },
      {
       "period": "202009",
       "invoicingPeriod": 9,
       "amortization": 6140.99,
       "interest": 1120.67,
       "depreciation": 6140.99
      },
      {
       "period": "202010",
       "invoicingPeriod": 10,
       "amortization": 6158.57,
       "interest": 1103.09,
       "depreciation": 6158.57
      },
      {
       "period": "202011",
       "invoicingPeriod": 11,
       "amortization": 6176.2,
       "interest": 1085.46,
       "depreciation": 6176.2
      },
      {
       "period": "202012",
       "invoicingPeriod": 12,
       "amortization": 6193.88,
       "interest": 1067.78,
       "depreciation": 6193.88
      },
      {
       "period": "202101",
       "invoicingPeriod": 13,
       "amortization": 6211.61,
       "interest": 1050.05,
       "depreciation": 6211.61
      },
      {
       "period": "202102",
       "invoicingPeriod": 14,
       "amortization": 6229.39,
       "interest": 1032.27,
       "depreciation": 6229.39
      },
      {
       "period": "202103",
       "invoicingPeriod": 15,
       "amortization": 6247.22,
       "interest": 1014.44,
       "depreciation": 6247.22
      },
      {
       "period": "202104",
       "invoicingPeriod": 16,
       "amortization": 6265.11,
       "interest": 996.55,
       "depreciation": 6265.11
      },
      {
       "period": "202105",
       "invoicingPeriod": 17,
       "amortization": 6283.04,
       "interest": 978.62,
       "depreciation": 6283.04
      },
      {
       "period": "202106",
       "invoicingPeriod": 18,
       "amortization": 6301.03,
       "interest": 960.63,
       "depreciation": 6301.03
      },
      {
       "period": "202107",
       "invoicingPeriod": 19,
       "amortization": 6319.06,
       "interest": 942.6,
       "depreciation": 6319.06
      },
      {
       "period": "202108",
       "invoicingPeriod": 20,
       "amortization": 6337.15,
       "interest": 924.51,
       "depreciation": 6337.15
      },
      {
       "period": "202109",
       "invoicingPeriod": 21,
       "amortization": 6355.29,
       "interest": 906.37,
       "depreciation": 6355.29
      },
      {
       "period": "202110",
       "invoicingPeriod": 22,
       "amortization": 6373.48,
       "interest": 888.18,
       "depreciation": 6373.48
      },
      {
       "period": "202111",
       "invoicingPeriod": 23,
       "amortization": 6391.73,
       "interest": 869.93,
       "depreciation": 6391.73
      },
      {
       "period": "202112",
       "invoicingPeriod": 24,
       "amortization": 6410.02,
       "interest": 851.64,
       "depreciation": 6410.02
      },
      {
       "period": "202201",
       "invoicingPeriod": 25,
       "amortization": 6428.37,
       "interest": 833.29,
       "depreciation": 6428.37
      },
      {
       "period": "202202",
       "invoicingPeriod": 26,
       "amortization": 6446.77,
       "interest": 814.89,
       "depreciation": 6446.77
      },
      {
       "period": "202203",
       "invoicingPeriod": 27,
       "amortization": 6465.23,
       "interest": 796.43,
       "depreciation": 6465.23
      },
      {
       "period": "202204",
       "invoicingPeriod": 28,
       "amortization": 6483.73,
       "interest": 777.93,
       "depreciation": 6483.73
      },
      {
       "period": "202205",
       "invoicingPeriod": 29,
       "amortization": 6502.29,
       "interest": 759.37,
       "depreciation": 6502.29
      },
      {
       "period": "202206",
       "invoicingPeriod": 30,
       "amortization": 6520.91,
       "interest": 740.75,
       "depreciation": 6520.91
      },
      {
       "period": "202207",
       "invoicingPeriod": 31,
       "amortization": 6539.57,
       "interest": 722.09,
       "depreciation": 6539.57
      },
      {
       "period": "202208",
       "invoicingPeriod": 32,
       "amortization": 6558.29,
       "interest": 703.37,
       "depreciation": 6558.29
      },
      {
       "period": "202209",
       "invoicingPeriod": 33,
       "amortization": 6577.06,
       "interest": 684.6,
       "depreciation": 6577.06
      },
      {
       "period": "202210",
       "invoicingPeriod": 34,
       "amortization": 6595.89,
       "interest": 665.77,
       "depreciation": 6595.89
      },
      {
       "period": "202211",
       "invoicingPeriod": 35,
       "amortization": 6614.77,
       "interest": 646.89,
       "depreciation": 6614.77
      },
      {
       "period": "202212",
       "invoicingPeriod": 36,
       "amortization": 6633.89,
       "interest": 627.77,
       "depreciation": 6633.89
      },
      {
       "period": "202301",
       "invoicingPeriod": 37,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202302",
       "invoicingPeriod": 38,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202303",
       "invoicingPeriod": 39,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202304",
       "invoicingPeriod": 40,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202305",
       "invoicingPeriod": 41,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202306",
       "invoicingPeriod": 42,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202307",
       "invoicingPeriod": 43,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202308",
       "invoicingPeriod": 44,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202309",
       "invoicingPeriod": 45,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202310",
       "invoicingPeriod": 46,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202311",
       "invoicingPeriod": 47,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202312",
       "invoicingPeriod": 48,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202401",
       "invoicingPeriod": 49,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202402",
       "invoicingPeriod": 50,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202403",
       "invoicingPeriod": 51,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202404",
       "invoicingPeriod": 52,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202405",
       "invoicingPeriod": 53,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202406",
       "invoicingPeriod": 54,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202407",
       "invoicingPeriod": 55,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202408",
       "invoicingPeriod": 56,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202409",
       "invoicingPeriod": 57,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202410",
       "invoicingPeriod": 58,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202411",
       "invoicingPeriod": 59,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202412",
       "invoicingPeriod": 60,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202501",
       "invoicingPeriod": 61,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202502",
       "invoicingPeriod": 62,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202503",
       "invoicingPeriod": 63,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202504",
       "invoicingPeriod": 64,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202505",
       "invoicingPeriod": 65,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202506",
       "invoicingPeriod": 66,
       "amortization": 7261.66,
       "interest": 0,
       "depreciation": 7261.66
      },
      {
       "period": "202507",
       "invoicingPeriod": 67,
       "amortization": 2150.2,
       "interest": 5111.46,
       "depreciation": 2150.2
      },
      {
       "period": "202508",
       "invoicingPeriod": 68,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202509",
       "invoicingPeriod": 69,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202510",
       "invoicingPeriod": 70,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202511",
       "invoicingPeriod": 71,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202512",
       "invoicingPeriod": 72,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202601",
       "invoicingPeriod": 73,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202602",
       "invoicingPeriod": 74,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202603",
       "invoicingPeriod": 75,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202604",
       "invoicingPeriod": 76,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202605",
       "invoicingPeriod": 77,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202606",
       "invoicingPeriod": 78,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202607",
       "invoicingPeriod": 79,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202608",
       "invoicingPeriod": 80,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202609",
       "invoicingPeriod": 81,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202610",
       "invoicingPeriod": 82,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202611",
       "invoicingPeriod": 83,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202612",
       "invoicingPeriod": 84,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202701",
       "invoicingPeriod": 85,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202702",
       "invoicingPeriod": 86,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202703",
       "invoicingPeriod": 87,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202704",
       "invoicingPeriod": 88,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202705",
       "invoicingPeriod": 89,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202706",
       "invoicingPeriod": 90,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202707",
       "invoicingPeriod": 91,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202708",
       "invoicingPeriod": 92,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202709",
       "invoicingPeriod": 93,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202710",
       "invoicingPeriod": 94,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202711",
       "invoicingPeriod": 95,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      },
      {
       "period": "202712",
       "invoicingPeriod": 96,
       "amortization": 0,
       "interest": 7261.66,
       "depreciation": 0
      }
     ]
    }
   }
  ]
 }
];
