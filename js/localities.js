/*
 * Tract locality registry.
 *
 * Every Virginia parcel outline comes from the statewide VGIN layer. Each entry
 * below adds what that locality publishes on top of it: owner, values, sales,
 * zoning, comprehensive plan, and land-use applications. Field names were read
 * from each county's live ArcGIS REST service (October 2026).
 *
 * f = logical field -> county field. Missing keys mean the county does not
 * publish that item in GIS; the app then shows a link to the county's own site.
 */
(function () {
  "use strict";

  var VGIN = {
    feature: "https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer/0",
    map: "https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/MapServer"
  };

  function google(q) { return "https://www.google.com/search?q=" + encodeURIComponent(q); }

  var L = {};

  // ---------------- Northern Virginia ----------------
  L["51059"] = {
    name: "Fairfax County", region: "Northern Virginia", depth: "deep",
    parcel: {
      url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/Parcels/FeatureServer/0",
      idField: "PIN", f: { id: "PIN" }
    },
    // Fairfax keeps assessment data in tables keyed by PARID (same text as PIN)
    joins: [
      { key: "PARID", url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/OpenData_A6/FeatureServer/2", latest: "TAXYR",
        f: { land: "APRLAND", impr: "APRBLDG", total: "APRTOT", priorTotal: "PRITOT", taxYear: "TAXYR", exempt: "FLAG4_DESC" } },
      { key: "PARID", url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/OpenData_A6/FeatureServer/1", latest: "TAXYR",
        f: { zoningDesc: "ZONING_DESC", use: "LUC_DESC", units: "LIVUNIT", water: "UTIL1_DESC", sewer: "UTIL2_DESC", gas: "UTIL3_DESC" } },
      { key: "PARID", url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/OpenData_A7/FeatureServer/1", latest: "TAXYR",
        f: { acres: "ACRES", addrNo: "ADRNO", addrStreet: "ADRSTR", addrSuffix: "ADRSUF", city: "CITYNAME", legal: "LEGAL1" } },
      { key: "PARID", url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/OpenData_A5/FeatureServer/1", latest: "SALEDT", many: true,
        f: { saleDate: "SALEDT", salePrice: "PRICE", deedBook: "BOOK", deedPage: "PAGE", saleType: "SALEVAL_DESC" } }
    ],
    nearby: { mode: "join", values: 0, sales: 3 },
    zoning: { url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/Zoning/FeatureServer/0", code: "ZONECODE", extra: { proffer: "PROFFER" }, kind: "feature" },
    plan: { url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/ComprehensivePlanLandUnits/FeatureServer/0", label: "Comp plan land unit", code: "GEO_UNIT", link: "PLAN_URL", kind: "feature" },
    cases: [
      { label: "Zoning applications", url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/Zoning_Projects_view/FeatureServer/0", kind: "feature",
        f: { number: "PROJECT_IDENTIFIER", name: "APPLICATION_NAME", desc: "DESCRIPTION", status: "STATUS" } },
      { label: "Zoning cases since 2000", url: "https://services1.arcgis.com/ioennV6PpG5Xodq0/ArcGIS/rest/services/Zoning_Cases_Post_2000/FeatureServer/0", kind: "feature",
        f: { number: "CASE_NUMBER", status: "STATUS", toZone: "ZONECODE", proffer: "PROFFER" } }
    ],
    links: {
      assessor: function (id) { return "https://icare.fairfaxcounty.gov/ffxcare/Datalets/Datalet.aspx?mode=profileall&UseSearch=no&pin=" + encodeURIComponent(id); },
      assessorLabel: "Owner, sales and values in iCARE",
      gis: "https://www.fairfaxcounty.gov/maps/",
      landRecords: "https://www.fairfaxcounty.gov/circuit/court-public-access-network-cpan",
      planning: "https://plus.fairfaxcounty.gov/"
    },
    notes: "Fairfax does not publish owner names in its open GIS data. The iCARE link shows the owner."
  };

  L["51107"] = {
    name: "Loudoun County", region: "Northern Virginia", depth: "deep",
    parcel: {
      url: "https://logis.loudoun.gov/gis/rest/services/COL/LandRecords/MapServer/5",
      idField: "PA_MCPI", f: { id: "PA_MCPI", acres: "PA_LEGAL_ACRE", subdivision: "PA_SUBD_NAME" }
    },
    zoning: { url: "https://logis.loudoun.gov/gis/rest/services/COL/Zoning/MapServer", layer: 3, code: "ZO_ZONE", name: "ZD_ZONE_NAME", extra: { ordinance: "ZO_ORDINANCE", rezoningCase: "ZO_PROJ_NUM" }, kind: "map" },
    plan: { url: "https://logis.loudoun.gov/gis/rest/services/COL/Planning/MapServer", layer: 10, label: "Place type (2019 General Plan)", code: "PT_PLACETYPE_FULL", kind: "map" },
    policy: { url: "https://logis.loudoun.gov/gis/rest/services/COL/Planning/MapServer", layer: 8, label: "Policy area", code: "PO_POLICY_FULL", sub: "PO_SUB_FULL" },
    cases: [
      { label: "Legislative applications", url: "https://logis.loudoun.gov/gis/rest/services/COL/PlanningZoning/MapServer", layer: 3, kind: "map",
        f: { number: "LA_APPLICATION_NUMBER", name: "LA_PROJECT_NAME", alt: "LA_APPLICATION_NAME", type: "LA_APPLICATION_TYPE", date: "LA_APPROVAL_DATE", desc: "LA_DESCRIPTION" } },
      { label: "Approved rezonings (ZMAP)", url: "https://logis.loudoun.gov/gis/rest/services/COL/Zoning/MapServer", layer: 5, kind: "map",
        f: { number: "ZO_PROJ_NUM", toZone: "ZO_ZONE", date: "ZO_ZONE_DATE" } }
    ],
    links: {
      assessor: function (id) { return "https://reparcelasmt.loudoun.gov/pt/Datalets/Datalet.aspx?mode=profileall&UseSearch=no&pin=" + encodeURIComponent(id); },
      assessorLabel: "Owner, sales and values (Loudoun parcel database)",
      gis: "https://logis.loudoun.gov/weblogis/",
      landRecords: "https://www.loudoun.gov/5097/Land-Records-Research-Kiosk",
      planning: "https://www.loudoun.gov/LOLA"
    },
    notes: "Loudoun publishes owner and values on its parcel database rather than in GIS; the link opens that parcel's record. For case files, search the application number in LOLA."
  };

  L["51153"] = {
    name: "Prince William County", region: "Northern Virginia", depth: "deep",
    parcel: {
      url: "https://gisweb.pwcva.gov/arcgis/rest/services/CountyMapper/LandRecords/MapServer/4",
      idField: "GPIN",
      f: { id: "GPIN", owner: "CAMA_OWNER_CUR", mail1: "CAMA_ADDRESS2", mail2: "CAMA_ADDRESS3", mailCity: "CAMA_CITY", mailState: "CAMA_STATE", mailZip: "CAMA_ZIPCODE",
           acres: "Acreage", deedAcres: "CAMA_DeedAcre", deedBook: "DeedBook", deedPage: "DeedPage", instrument: "DeedInstrument", recorded: "RecordedDate",
           use: "UseDescription", subdivision: "SubdivisionName", addrNo: "StreetNumber", addrStreet: "StreetName", addrSuffix: "StreetType" }
    },
    ownerSearch: true,
    zoning: { url: "https://gisweb.pwcva.gov/arcgis/rest/services/CountyMapper/LandDevelopment/MapServer", layer: 3, code: "ZoningDistrict", extra: { rezoningCase: "ZoningCaseNumber", caseName: "ZoningCaseName", proffer: "PROFFERS" }, kind: "map" },
    plan: { url: "https://gisweb.pwcva.gov/arcgis/rest/services/CountyMapper/LandDevelopment/MapServer", layer: 4, label: "Long range land use", code: "LandUseWithTransect", alt: "LongRangeLandUse", link: "DocumentLink1", kind: "map" },
    cases: [
      { label: "Pending planning cases", url: "https://gisweb.pwcva.gov/arcgis/rest/services/CountyMapper/LandDevelopment/MapServer", layer: 2, kind: "map",
        f: { number: "PlanningCaseNumber", name: "PlanningCaseName", type: "PlanningCaseType", status: "status", date: "TransmittalDate", desc: "pln_descrip_prop", acres: "GISAcreage", link: "StaffReportLink" } }
    ],
    links: {
      assessor: function () { return "https://www.pwcva.gov/department/real-estate-assessments"; },
      assessorLabel: "Assessed values (Real Estate Assessments)",
      gis: "https://gisweb.pwcva.gov/webapps/countymapper/",
      landRecords: "https://www.pwcva.gov/department/circuit-court-clerk",
      planning: "https://www.pwcva.gov/department/planning-office"
    },
    notes: "Prince William publishes owner, acreage and deed reference in GIS. Assessed values are on the county's assessment site."
  };

  L["51179"] = {
    name: "Stafford County", region: "Northern Virginia", depth: "partial",
    parcel: {
      url: "https://services1.arcgis.com/qKiA6JuCrE2l72iL/arcgis/rest/services/Parcels/FeatureServer/0",
      idField: "PRCLID", f: { id: "PRCLID", address: "FULLADD", use: "LUGROUP", units: "EXDU" }
    },
    zoning: { url: "https://services1.arcgis.com/qKiA6JuCrE2l72iL/arcgis/rest/services/Zoning/FeatureServer/0", code: "ZONE1", extra: { secondZone: "ZONE2", conditions: "COND_PRMT" }, kind: "feature" },
    links: {
      assessor: function () { return "https://staffordcountyva.gov/government/departments_r-z/commissioner_of_the_revenue/real_estate_assessment.php"; },
      assessorLabel: "Owner and values (Commissioner of the Revenue)",
      gis: "https://staffordcountyva.gov/government/departments_a-g/gis/index.php",
      landRecords: google("Stafford County Virginia circuit court land records remote access"),
      planning: "https://staffordcountyva.gov/government/departments_r-z/planning_and_zoning/index.php"
    },
    notes: "Stafford's public parcel layer has addresses and land use but not owners or values."
  };

  L["51061"] = {
    name: "Fauquier County", region: "Northern Virginia", depth: "deep",
    parcel: {
      url: "https://services.arcgis.com/oAoeYJ1kqmAwcEC2/arcgis/rest/services/Tax_Parcels_DL/FeatureServer/0",
      idField: "PARCELID", textNumbers: true,
      f: { id: "PARCELID", owner: "OWNERNME1", owner2: "Co_Owner2", mail1: "PSTLADDRES", mailCity: "PSTLCITY", mailState: "PSTLSTATE", mailZip: "PSTLZIP5",
           address: "SITEADDRES", acres: "ACREAGE", land: "Land_Value", impr: "Building_V", total: "Total_ASSE", useValue: "Land_Def_V",
           saleDate: "LASTSALEDA", salePrice: "LASTSALEPR", use: "Primary_Us", yearBuilt: "Year_Built", livingArea: "Living_Are", subdivision: "Subdivisio", legal: "Legal_Desc" }
    },
    ownerSearch: true,
    nearby: { mode: "fields" },
    zoning: { url: "https://services.arcgis.com/oAoeYJ1kqmAwcEC2/arcgis/rest/services/Zoning_Districts_DL/FeatureServer/0", code: "ZONECLASS", name: "ZONEDESC", kind: "feature" },
    links: {
      assessor: function () { return "https://www.fauquiercounty.gov/government/departments-h-z/commissioner-of-the-revenue/real-estate"; },
      assessorLabel: "Commissioner of the Revenue, real estate",
      gis: "https://www.fauquiercounty.gov/government/departments-a-g/gis",
      landRecords: google("Fauquier County circuit court land records remote access"),
      planning: "https://www.fauquiercounty.gov/government/departments-h-z/community-development"
    }
  };

  // ---------------- Fredericksburg to Richmond ----------------
  L["51177"] = {
    name: "Spotsylvania County", region: "Fredericksburg to Richmond", depth: "deep",
    parcel: {
      url: "https://gis.spotsylvania.va.us/arcgis/rest/services/Spotsylvania_Public_Prod/MapServer/8",
      idField: "GPIN", textNumbers: true,
      f: { id: "GPIN", mapPin: "MAP_Pin", areaSqft: "SHAPE.STArea()", owner: "OwnerSearch", mail1: "MAILADDRESS", mailCity: "CITY", mailState: "STATE", mailZip: "ZIPCODE", address: "PROPADDRESS",
           acres: "LANDAREA", land: "LANDASSESSMENT", impr: "BLDGASSESSMENT", saleDate: "TRANSFERDATE", salePrice: "SALEPRICE", deedBook: "BOOKNUM", deedPage: "PAGE",
           instrument: "INSTNO", yearBuilt: "YEARBUILT", livingArea: "SQFEET", zoningCode: "ZONING", compPlan: "COMP_PLAN", flood: "FLOOD_100", rpa: "RPA", wetland: "WETLAND",
           subdivision: "SUBDIVISION_Name", use: "LANDUSE", legal: "LEGAL1" }
    },
    ownerSearch: true,
    nearby: { mode: "fields" },
    zoning: { url: "https://gis.spotsylvania.va.us/arcgis/rest/services/Spotsylvania_Public_Prod/MapServer", layer: 27, code: "ZONECLASS", name: "ZONEDESC", kind: "map" },
    plan: { url: "https://gis.spotsylvania.va.us/arcgis/rest/services/Spotsylvania_Public_Prod/MapServer", layer: 23, label: "Future land use", code: "LANDUSEDESC", extra: { density: "DENSITY" }, kind: "map" },
    cases: [
      { label: "Public hearing cases", url: "https://gis.spotsylvania.va.us/arcgis/rest/services/PublicHearingCases/Public_Hearing_Cases_Locations/FeatureServer/0", kind: "feature",
        f: { number: "App_Number", name: "Project_Name", applicant: "Applicant", type: "ProjectType", status: "Status", date: "HearingDate", desc: "Description", link: "ApplicationLink" } }
    ],
    links: {
      assessor: function () { return "https://www.spotsylvania.va.us/185/Real-Estate-Assessments"; },
      assessorLabel: "Real estate assessments",
      gis: "https://gis.spotsylvania.va.us/",
      landRecords: google("Spotsylvania circuit court land records remote access"),
      planning: "https://www.spotsylvania.va.us/1203/Planning"
    }
  };

  L["51033"] = {
    name: "Caroline County", region: "Fredericksburg to Richmond", depth: "deep",
    parcel: {
      url: "https://services8.arcgis.com/javH2x6lNvVqxMm3/arcgis/rest/services/Zoning_Map_WFL1/FeatureServer/0",
      idField: "map_pin",
      f: { id: "map_pin", owner: "OWNER1", owner2: "OWNER2", mail1: "OWN_ADDR1", mail2: "OWN_ADDR2", mailCity: "OWN_CITY", mailState: "OWN_STATE", mailZip: "OWN_ZIP",
           address: "SITE_ADDR", acres: "LOT_SIZE", land: "LAND_VAL", impr: "BLDG_VAL", total: "TOTAL_VAL", salePrice: "LS_PRICE", saleDate: "LS_DATE2",
           deedBook: "LS_BOOK", deedPage: "LS_PAGE", zoningCode: "ZONE", yearBuilt: "YEAR_BUILT", livingArea: "RES_AREA", use: "USE_CODE", fiscalYear: "FY" }
    },
    ownerSearch: true,
    nearby: { mode: "fields" },
    zoning: { url: "https://services8.arcgis.com/javH2x6lNvVqxMm3/arcgis/rest/services/Zoning_Map_WFL1/FeatureServer/1", code: "New_Zoning", kind: "feature" },
    links: {
      gis: "https://co.caroline.va.us/",
      landRecords: google("Caroline County Virginia circuit court land records"),
      assessor: function () { return google("Caroline County Virginia real estate assessment search"); },
      assessorLabel: "Caroline County assessment search"
    }
  };

  L["51085"] = {
    name: "Hanover County", region: "Fredericksburg to Richmond", depth: "basic",
    links: {
      gis: "https://www.hanovercounty.gov/1022/GIS",
      landRecords: google("Hanover County Virginia circuit court land records"),
      assessor: function () { return "https://www.hanovercounty.gov/347/Assessor"; },
      assessorLabel: "Hanover County Assessor"
    }
  };

  L["51087"] = {
    name: "Henrico County", region: "Fredericksburg to Richmond", depth: "deep", stale: "Henrico's open parcel file is a March 2022 snapshot. Check current owner and values on the county site.",
    parcel: {
      url: "https://services.arcgis.com/LxWK4CxNTBBlLshT/arcgis/rest/services/Henrico_County_Tax_Parcels_0322/FeatureServer/0",
      idField: "GPIN",
      f: { id: "GPIN", owner: "OWNER_CURRENT", mail1: "MAILING_ADDRESS_01", mail2: "MAILING_ADDRESS_02", mailCity: "MAILING_ADDRESS_03", address: "FULL_ADDRESS",
           acres: "PARCEL_ACREAGE", land: "LAND_VALUE_CURRENT", impr: "IMPROVEMENTS_VALUE_CURRENT", saleDate: "LAST_SALE_DATE", salePrice: "LAST_SALE_PRICE",
           deedBook: "DEED_BOOK", deedPage: "DEED_PAGE", yearBuilt: "YEAR_BUILT", livingArea: "SQFT_FINISHED", use: "USE_DESCRIPTION", subdivision: "SUBDIVISION_NAME", water: "WATER_SEWER_DESCRIPTION" }
    },
    ownerSearch: true,
    nearby: { mode: "fields" },
    links: {
      assessor: function () { return "https://henrico.gov/assessor/"; },
      assessorLabel: "Henrico Real Estate Assessment",
      gis: "https://henrico.gov/gis/",
      landRecords: google("Henrico County circuit court land records remote access"),
      planning: "https://henrico.gov/planning/"
    }
  };

  L["51041"] = {
    name: "Chesterfield County", region: "Fredericksburg to Richmond", depth: "deep",
    parcel: {
      url: "https://services3.arcgis.com/TsynfzBSE6sXfoLq/arcgis/rest/services/Cadastral_ProdA/FeatureServer/3",
      idField: "GPIN",
      f: { id: "GPIN", taxId: "TaxID", owner: "OwnerName", mail1: "OwnerAddress", mailCity: "OwnerCity", mailState: "OwnerState", mailZip: "OwnerZip", address: "Address",
           acres: "DeededAcres", impr: "ImprovementValue", total: "TotalAssessment", useValue: "LandUseValue", assessYear: "AssessmentYear",
           saleDate: "SaleDate", salePrice: "SalePrice", deedBook: "DeedBook", deedPage: "Page", yearBuilt: "YearBuilt", livingArea: "FinishedArea", use: "UseCode",
           subdivision: "SubdivisionName", water: "WaterConnect", sewer: "SewerConnect", floodAcres: "FloodAcres", rpaAcres: "RpaAcres", easementAcres: "EsmtAcres" }
    },
    ownerSearch: true,
    nearby: { mode: "fields" },
    zoning: { url: "https://services3.arcgis.com/TsynfzBSE6sXfoLq/arcgis/rest/services/Planning_ProdA/FeatureServer/34", code: "ZoningDistrict", name: "DistrictName", link: "OrdinanceLink", kind: "feature" },
    plan: { url: "https://services3.arcgis.com/TsynfzBSE6sXfoLq/arcgis/rest/services/Planning_ProdA/FeatureServer/10", label: "Land use plan", code: "LandUsePlan", extra: { plan: "PlanName" }, link: "LandUsePlanDocument", kind: "feature" },
    cases: [
      { label: "Zoning cases", url: "https://services3.arcgis.com/TsynfzBSE6sXfoLq/arcgis/rest/services/Planning_ProdA/FeatureServer/21", kind: "feature",
        f: { number: "CaseNum", name: "CaseName", type: "RequestType", status: "Status", date: "FinalDate", desc: "CaseDescription", acres: "Acres", cashProffer: "CashProffer",
             sfd: "SingleFamilyUnits", th: "TownhouseUnits", condo: "CondoUnits", apt: "ApartmentUnits" } }
    ],
    links: {
      assessor: function () { return "https://www.chesterfield.gov/1105/Real-Estate-Assessments"; },
      assessorLabel: "Real Estate Assessments",
      gis: "https://www.chesterfield.gov/1229/GIS",
      landRecords: google("Chesterfield County circuit court land records remote access"),
      planning: "https://www.chesterfield.gov/162/Planning"
    }
  };

  // ---------------- Hampton Roads ----------------
  L["51810"] = {
    name: "Virginia Beach", region: "Hampton Roads", depth: "deep",
    parcel: {
      url: "https://geo.vbgov.com/mapservices/rest/services/Basemaps/Property_Information/MapServer/12",
      idField: "PAR_GPIN",
      f: { id: "PAR_GPIN", address: "PROP_ADDRESS", zoningCode: "ZONING", use: "LAND_USE", compPlan: "GP_COMP", flood: "FEMA_ZONE_BLDG", noise: "NOISE_ZONE", aicuz: "AICUZ_ZONE",
           subdivision: "SUBDIVISION", instrument: "INSTRUMENT", propClass: "PROP_CLASS" }
    },
    joins: [
      { key: "GPIN", parcelKey: "PAR_GPIN", url: "https://services2.arcgis.com/CyVvlIiUfRBmMQuu/arcgis/rest/services/Property_Sales_/FeatureServer/0", latest: "Sales_Date", many: true,
        f: { land: "Land_Value", impr: "Improvement_Value", total: "Total_Value", saleDate: "Sales_Date", salePrice: "Sale_Price", deedBook: "Deed_Book", deedPage: "Deed_Page", instrument: "Document_Number" } }
    ],
    nearby: { mode: "join", values: 0, sales: 0 },
    links: {
      assessor: function () { return "https://www.vbgov.com/government/departments/real-estate-assessor/Pages/default.aspx"; },
      assessorLabel: "Real Estate Assessor",
      gis: "https://www.vbgov.com/government/departments/communications-info-technology/maps/Pages/default.aspx",
      landRecords: google("Virginia Beach circuit court land records remote access"),
      planning: "https://planning.vbgov.com/"
    },
    notes: "Virginia Beach publishes values and sales in its sales file, so values show only for parcels that have sold."
  };

  L["51550"] = {
    name: "Chesapeake", region: "Hampton Roads", depth: "deep",
    parcel: {
      url: "https://gis.cityofchesapeake.net/mapping/rest/services/OpenData/OpenData/MapServer/15",
      idField: "PARNO",
      f: { id: "PARNO", mapParcel: "MAP_PARCEL", address: "ADDRESS", acres: "CALCACREAGE", deedBook: "DEEDBK", deedPage: "DEEDPG", use: "PROPCLASS", legal: "LEGAL", transfer: "TRANSFER" }
    },
    zoning: { url: "https://gis.cityofchesapeake.net/mapping/rest/services/OpenData/OpenData/MapServer", layer: 26, code: "CLASS", extra: { rezoningCase: "APPNO", proffer: "PROFFERS", project: "PROJECT" }, kind: "map" },
    cases: [
      { label: "Development tracking", url: "https://gis.cityofchesapeake.net/mapping/rest/services/OpenData/OpenData/MapServer", layer: 9, kind: "map",
        f: { number: "APPLICATIO", name: "PROJECT_NA", type: "TYPE_", status: "RESULTS", fromZone: "ZONING_FRO", toZone: "ZONING_TO", units: "HOUSING_UN", date: "DATEOFAPPL", council: "CC_ACTION", link: "EBUILD_LINK" } }
    ],
    links: {
      assessor: function () { return "https://www.cityofchesapeake.net/1018/Real-Estate-Assessor"; },
      assessorLabel: "Real Estate Assessor",
      gis: "https://www.cityofchesapeake.net/",
      landRecords: google("Chesapeake circuit court land records remote access"),
      planning: "https://www.cityofchesapeake.net/1137/Planning"
    }
  };

  L["51800"] = {
    name: "Suffolk", region: "Hampton Roads", depth: "basic",
    links: {
      gis: "https://www.suffolkva.us/",
      landRecords: google("Suffolk Virginia circuit court land records"),
      assessor: function () { return google("Suffolk Virginia real estate assessor parcel search"); },
      assessorLabel: "Suffolk assessor search"
    }
  };

  L["51700"] = {
    name: "Newport News", region: "Hampton Roads", depth: "deep",
    parcel: {
      url: "https://maps.nnva.gov/gis/rest/services/Operational/Parcel/MapServer/0",
      idField: "PARCELID", textFields: ["STATEDAREA"],
      f: { id: "PARCELID", owner: "OWNERNME1", owner2: "OWNERNME2", mail1: "PSTLADDRESS1", mailCity: "PSTLCITY", mailState: "PSTLSTATE", mailZip: "PSTLZIP5", address: "SITEADDRESS",
           acres: "STATEDAREA", land: "CNTLNDVAL", impr: "CNTIMPVAL", saleDate: "LASTSALEDATE", salePrice: "LASTSALEPRICE", deed: "DEED", zoningCode: "ZONE", flood: "FLOODZONE",
           yearBuilt: "RESYRBLT", livingArea: "RESFLRAREA", use: "USEDSCRP", subdivision: "SUBDIVDSCRP", vacant: "VACANT", link: "PublicLink" }
    },
    ownerSearch: true,
    nearby: { mode: "fields" },
    plan: { url: "https://maps.nnva.gov/gis/rest/services/Operational/FutureLandUse2040/MapServer", layer: 0, label: "Future land use (2040 plan)", code: "CODE", kind: "map" },
    links: {
      assessor: function () { return "https://www.nnva.gov/1240/Real-Estate-Assessor"; },
      assessorLabel: "Real Estate Assessor",
      gis: "https://www.nnva.gov/",
      landRecords: google("Newport News circuit court land records"),
      planning: "https://www.nnva.gov/546/Planning"
    }
  };

  L["51095"] = {
    name: "James City County", region: "Hampton Roads", depth: "deep",
    parcel: {
      url: "https://property.jamescitycountyva.gov/arcgis/rest/services/JCC/GIS_Data/FeatureServer/17",
      idField: "PIN",
      f: { id: "PIN", owner: "Owner1", owner2: "Owner2", mail1: "MailAddr", mailCity: "MailCity", mailState: "MailStat", mailZip: "MailZip", address: "Full_Address",
           acres: "LegalAc", land: "CurLand", impr: "CurImp", total: "CurTot", priorTotal: "PrevTot", saleDate: "Sale1D", salePrice: "Sale1Amt", instrument: "Doc1Num", grantor: "Grantor1",
           sale2Date: "Sale2D", sale2Price: "Sale2Amt", sale2From: "Grantor2", sale3Date: "Sale3D", sale3Price: "Sale3Amt", sale3From: "Grantor3",
           zoningCode: "Zoning", compPlan: "Comp_Plan", yearBuilt: "YrBuilt", livingArea: "FinSize", use: "PCDesc", subdivision: "SUBNAME", legal: "Legal1", pricePerAcre: "PricePerAcre" }
    },
    ownerSearch: true,
    nearby: { mode: "fields" },
    links: {
      assessor: function () { return "https://property.jamescitycountyva.gov/"; },
      assessorLabel: "James City County property information",
      gis: "https://www.jamescitycountyva.gov/",
      landRecords: google("Williamsburg James City County circuit court land records"),
      planning: "https://www.jamescitycountyva.gov/"
    }
  };

  // Ordered list for the coverage screen
  var ORDER = ["51059", "51107", "51153", "51179", "51061", "51177", "51033", "51085", "51087", "51041", "51810", "51550", "51800", "51700", "51095"];

  window.TRACT_LOCALITIES = { VGIN: VGIN, byFips: L, order: ORDER, google: google };
})();
