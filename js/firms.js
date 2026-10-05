/*
 * Firm profiles for Tract. Written from public sources (linked on each profile).
 * ownerPatterns: text searched in county owner fields. casePatterns: text searched in
 * county rezoning/land-use case names, applicants and descriptions.
 */
window.TRACT_FIRMS = {
  updated: "Oct 5, 2026",
  firms: [
    // ---------------- Public homebuilders ----------------
    {
      key: "nvr", name: "NVR (Ryan Homes, NVHomes)", aliases: ["NVR", "Ryan Homes", "NVHomes", "Heartland Homes"], type: "public",
      tagline: "Reston-based builder that buys finished lots instead of developing land",
      hq: "Reston, Virginia", ticker: "NVR", website: "https://www.nvrinc.com",
      vaOffices: "Headquarters in Reston; Ryan Homes and NVHomes divisions across Northern Virginia, Fredericksburg, Richmond and Hampton Roads",
      summary: "NVR builds under Ryan Homes, NVHomes and Heartland Homes. Its Mid Atlantic segment (Virginia, Maryland, West Virginia, Delaware and D.C.) is its largest: 8,287 homes settled there in 2025 out of 21,915 company-wide, with 125 of its 432 active communities.",
      strategy: "NVR's model is lot purchase agreements: it contracts for finished lots from land developers, puts down a forfeitable deposit (usually up to about 10% of the price), and takes lots as it needs them. It says it generally does not develop land itself, using joint ventures or direct ownership only in limited cases.\n\nFor a land seller or developer, that makes NVR a lot buyer rather than a raw land buyer. Pitch entitled, engineered sections with a takedown schedule.",
      numbers: [["Homes settled, 2025", "21,915"], ["Lots controlled, Dec 31 2025", "180,100"], ["Mid Atlantic lots controlled", "60,100"], ["Active communities", "432 (125 Mid Atlantic)"]],
      people: [{ name: "Eugene J. Bredow", title: "President and CEO" }, { name: "Paul C. Saville", title: "Executive Chairman" }, { name: "Daniel D. Malzahn", title: "SVP, CFO and Treasurer" }],
      projects: [{ name: "Potomac Shores (with other builders)", locality: "Stafford / Prince William", detail: "Ryan Homes and NVHomes have built in the SunCal master plan" }],
      ownerPatterns: ["NVR"], casePatterns: ["NVR", "RYAN HOMES", "NVHOMES"],
      sources: [
        { label: "NVR Form 10-K, fiscal 2025 (SEC)", url: "https://www.sec.gov/Archives/edgar/data/906163/000090616326000018/nvr-20251231.htm" },
        { label: "NVR 2026 proxy statement (SEC)", url: "https://www.sec.gov/Archives/edgar/data/906163/000090616326000029/nvr-20260316.htm" }
      ]
    },
    {
      key: "toll", name: "Toll Brothers", aliases: ["Toll Brothers", "Toll"], type: "public",
      tagline: "Luxury builder with a D.C. Metro division active in Loudoun and Fairfax",
      hq: "Fort Washington, Pennsylvania", ticker: "TOL", website: "https://www.tollbrothers.com",
      vaOffices: "D.C. Metro division covering Northern Virginia",
      summary: "Toll builds luxury single-family homes and higher-end townhomes and condos. Its Mid-Atlantic segment, which includes the Virginia and Maryland suburbs of D.C., delivered 2,141 homes in fiscal 2025 and had 68 selling communities at year end. Recent Northern Virginia openings include Avonmore in Ashburn (single-family from about $1.9M) and Cedar Terrace in South Riding (townhomes and condos), plus Parkside Village in Aldie and Riverfield Estates in Leesburg.",
      strategy: "Toll mixes outright land purchases with options and joint ventures. At the end of fiscal 2025 it controlled about 76,100 home sites, with roughly 57% held through options and purchase agreements rather than owned, which defers land spending until closer to delivery.",
      numbers: [["Homes delivered, FY2025", "11,292"], ["Home sites controlled, Oct 31 2025", "about 76,100"], ["Share optioned rather than owned", "about 57%"], ["Mid-Atlantic deliveries, FY2025", "2,141"]],
      people: [{ name: "Nimita Shah", title: "Division President, D.C. Metro" }],
      projects: [
        { name: "Avonmore", locality: "Ashburn, Loudoun", detail: "Boutique single-family community", status: "Selling" },
        { name: "Cedar Terrace", locality: "South Riding (Chantilly), Loudoun", detail: "Townhomes and condos; opening spring 2026", status: "Opening" },
        { name: "Parkside Village", locality: "Aldie, Loudoun", detail: "Model collections announced" },
        { name: "Riverfield Estates", locality: "Leesburg, Loudoun", detail: "Announced as coming soon" },
        { name: "Toll Brothers at West Park", locality: "Brambleton (Ashburn), Loudoun", detail: "Single-family homes near Ryan Road and Hillside Farm Drive, from the upper $700s", status: "Coming soon" }
      ],
      ownerPatterns: ["TOLL BROTHERS", "TOLL VA", "TOLL LAND"], casePatterns: ["TOLL BROTHERS"],
      sources: [
        { label: "Toll Brothers Form 10-K, fiscal 2025 (SEC)", url: "https://www.sec.gov/Archives/edgar/data/794170/000079417025000112/tol-20251031.htm" },
        { label: "Toll Brothers: Avonmore in Ashburn now open", url: "https://www.tollbrothers.com/blog/avonmore-ashburn-virginia-now-open" },
        { label: "Toll Brothers: Cedar Terrace coming to Chantilly (Dec 2025)", url: "https://www.barchart.com/story/news/36672785/new-toll-brothers-luxury-home-community-coming-soon-to-chantilly-virginia" },
        { label: "Toll Brothers: West Park in Ashburn coming soon (2026)", url: "https://www.tollbrothers.com/blog/toll-brothers-at-west-park-ashburn-virginia-coming-soon" }
      ]
    },
    {
      key: "drhorton", name: "D.R. Horton", aliases: ["D.R. Horton", "DR Horton", "Horton", "Forestar"], type: "public",
      tagline: "The country's largest builder by volume, with four Virginia market areas",
      hq: "Arlington, Texas", ticker: "DHI", website: "https://www.drhorton.com/virginia",
      vaOffices: "Northern Virginia division (Tysons), plus Richmond, Charlottesville and Southern Virginia",
      summary: "D.R. Horton closed 84,863 homes in fiscal 2025 at an average price of about $370,000. Virginia is part of its East region. Its Virginia site lists Northern Virginia, Richmond, Charlottesville and Southern Virginia market areas.",
      strategy: "Horton leans on its majority-owned lot developer, Forestar, for finished lots: Forestar sold 14,240 lots in fiscal 2025 and 83% of them went to D.R. Horton. Expect Horton to favor option contracts and finished-lot deals over holding raw land.",
      numbers: [["Homes closed, FY2025", "84,863"], ["Average closing price", "about $370,400"], ["Forestar lots sold, FY2025", "14,240 (83% to D.R. Horton)"]],
      people: [],
      projects: [{ name: "Sierra Ridge", locality: "King George", detail: "Listed under the Northern Virginia division" }, { name: "Goochland subdivision", locality: "Goochland", detail: "Nearly 200 homes planned (reported July 2026)" }],
      ownerPatterns: ["D R HORTON", "DR HORTON", "D.R. HORTON", "FORESTAR"], casePatterns: ["HORTON", "FORESTAR"],
      sources: [
        { label: "D.R. Horton Form 10-K, fiscal 2025 (SEC)", url: "https://www.sec.gov/Archives/edgar/data/882184/000088218425000081/dhi-20250930.htm" },
        { label: "D.R. Horton: Virginia", url: "https://www.drhorton.com/va" },
        { label: "Richmond BizSense: D.R. Horton to build nearly 200 homes in Goochland (Jul 2026)", url: "https://richmondbizsense.com/2026/07/06/d-r-horton-on-deck-to-build-nearly-200-home-subdivision-in-goochland/" }
      ]
    },
    {
      key: "lennar", name: "Lennar", aliases: ["Lennar"], type: "public",
      tagline: "Second-largest U.S. builder, expanding in Northern Virginia, Richmond and Hampton Roads",
      hq: "Miami, Florida", ticker: "LEN", website: "https://www.lennar.com",
      vaOffices: "D.C. Metro Virginia, Richmond and Hampton Roads (Suffolk) operations",
      summary: "Lennar named Goose Creek Village in Ashburn (two-story townhomes) in its May 2026 announcement of more than 40 new Northeast communities. In Richmond it bought into Chesterfield's Harpers Mill with a $25 million land deal in 2022, and it has hired land acquisition managers for the Hampton Roads market out of Suffolk.",
      strategy: "Lennar runs a land-light approach, controlling most of its future lots through options and land banking partners rather than owning them outright, and focuses on even-flow production.",
      numbers: [],
      people: [],
      projects: [
        { name: "Goose Creek Village", locality: "Ashburn, Loudoun", detail: "Luxury two-story townhomes", status: "Open" },
        { name: "Harpers Mill", locality: "Chesterfield", detail: "Entered via $25M land deal (2022)" }
      ],
      ownerPatterns: ["LENNAR"], casePatterns: ["LENNAR"],
      sources: [
        { label: "Lennar: Northeast expansion with 40+ new communities (May 2026)", url: "https://newsroom.lennar.com/2026-05-04-Lennar-Expands-Northeast-Presence-with-Over-40-New-Communities-in-2026" },
        { label: "Richmond BizSense: Lennar buys into Harpers Mill (2022)", url: "https://richmondbizsense.com/2022/03/08/national-homebuilder-lennar-buys-into-harpers-mill-with-25m-land-deal/" }
      ]
    },
    {
      key: "pulte", name: "PulteGroup (Pulte, Del Webb)", aliases: ["Pulte", "PulteGroup", "Del Webb", "Centex"], type: "public",
      tagline: "Builds move-up and active-adult (Del Webb) homes across Northern Virginia",
      hq: "Atlanta, Georgia", ticker: "PHM", website: "https://www.pulte.com/homes/virginia/northern-virginia",
      vaOffices: "Northern Virginia operations",
      summary: "Pulte's Northern Virginia pages cover Ashburn, Fairfax, Herndon, Reston, Loudoun County and Potomac Shores, and Del Webb runs 55+ communities in the region. In 2024 Pulte announced a townhome and condo community in central Fairfax. At Potomac Shores, Pulte took 231 townhome lots alongside Brookfield, NVHomes and Ryan Homes.",
      strategy: "Pulte builds across entry-level, move-up and active-adult buyers and has been shifting more of its lot pipeline to option control.",
      numbers: [],
      people: [],
      projects: [{ name: "Potomac Shores townhomes", locality: "Prince William", detail: "231 townhomes in the SunCal master plan" }],
      ownerPatterns: ["PULTE", "DEL WEBB"], casePatterns: ["PULTE", "DEL WEBB"],
      sources: [
        { label: "Pulte: Northern Virginia", url: "https://pulte.com/homes/virginia/northern-virginia" },
        { label: "Builder: Brookfield, Pulte move into Potomac Shores", url: "https://www.builderonline.com/land/development/brookfield-pulte-move-into-potomac-shores_o" }
      ]
    },
    {
      key: "khov", name: "K. Hovnanian Homes", aliases: ["K. Hovnanian", "Hovnanian", "K Hov"], type: "public",
      tagline: "Virginia division in Herndon, building from Lorton to Fredericksburg",
      hq: "Matawan, New Jersey", ticker: "HOV", website: "https://www.khov.com",
      vaOffices: "Virginia division (Herndon)",
      summary: "Current and upcoming Virginia communities include Occoquan Overlook in Lorton, Old Dominion Meadows in Nokesville, Rocky Run Village and Hazel Run Glen in the Fredericksburg area, and Aspire at Wilderness Shores, a 55+ community in Locust Grove.",
      strategy: "Hovnanian has moved toward controlling lots through options and land banking to reduce the land it owns outright.",
      numbers: [],
      people: [],
      projects: [
        { name: "Occoquan Overlook", locality: "Lorton, Fairfax", status: "Coming soon" },
        { name: "Old Dominion Meadows", locality: "Nokesville, Prince William", status: "Coming soon" },
        { name: "Rocky Run Village", locality: "Fredericksburg area" },
        { name: "Hazel Run Glen", locality: "Fredericksburg" },
        { name: "Aspire at Wilderness Shores", locality: "Locust Grove, Orange", detail: "55+" }
      ],
      ownerPatterns: ["HOVNANIAN"], casePatterns: ["HOVNANIAN"],
      sources: [
        { label: "K. Hovnanian: Virginia communities", url: "https://www.khov.com/find-new-homes/virginia/stafford-county" },
        { label: "K. Hovnanian: Old Dominion Meadows", url: "https://kiosk.khov.com/new-construction-homes/virginia/nokesville/old-dominion-meadows" },
        { label: "K. Hovnanian: Occoquan Overlook", url: "https://www.khov.com/new-construction-homes/virginia/lorton/occoquan-overlook" }
      ]
    },
    {
      key: "dreamfinders", name: "Dream Finders Homes", aliases: ["Dream Finders"], type: "public",
      tagline: "Jacksonville builder with a D.C. Metro division in Northern Virginia",
      hq: "Jacksonville, Florida", ticker: "DFH", website: "https://dreamfindershomes.com/new-homes/va/dc-metro-virginia/",
      vaOffices: "D.C. Metro division",
      summary: "Dream Finders' D.C. Metro Virginia lineup includes Sunset Station in Reston (from about $1.02M) and South Springs in Chantilly (coming soon, from the upper $500s).",
      strategy: "Dream Finders is known for an asset-light model, controlling most lots through options and land bank arrangements and growing by acquiring regional builders. In August 2026 it agreed to buy Beazer Homes for about $2.2 billion in cash, a deal expected to close in the fourth quarter of 2026 that would make it the sixth largest U.S. builder.",
      numbers: [],
      people: [],
      projects: [
        { name: "Sunset Station", locality: "Reston, Fairfax", status: "Selling" },
        { name: "South Springs", locality: "Chantilly", status: "Coming soon" }
      ],
      ownerPatterns: ["DREAM FINDERS"], casePatterns: ["DREAM FINDERS"],
      sources: [
        { label: "Dream Finders: D.C. Metro Virginia", url: "https://dreamfindershomes.com/new-homes/va/dc-metro-virginia/" },
        { label: "Business Wire: Dream Finders Homes to acquire Beazer Homes (Aug 2026)", url: "https://secure.businesswire.com/news/home/20260806292783/en/Dream-Finders-Homes-to-Acquire-Beazer-Homes-Creating-Sixth-Largest-U.S.-Homebuilder" }
      ]
    },
    {
      key: "taylormorrison", name: "Taylor Morrison", aliases: ["Taylor Morrison", "Yardly"], type: "public",
      tagline: "National builder owned by Berkshire Hathaway since July 2026; limited Virginia footprint",
      hq: "Scottsdale, Arizona", ticker: "", website: "https://www.taylormorrison.com",
      vaOffices: "No Virginia division listed",
      summary: "Taylor Morrison doesn't list a Virginia division, so county records here will rarely show it. Berkshire Hathaway completed its all-cash purchase of the company in July 2026, so its shares no longer trade. Its Yardly brand builds for-rent single-family communities in Sun Belt markets.",
      strategy: "",
      numbers: [], people: [], projects: [],
      ownerPatterns: ["TAYLOR MORRISON"], casePatterns: ["TAYLOR MORRISON"],
      sources: [{ label: "Business Wire: Berkshire Hathaway completes acquisition of Taylor Morrison (Jul 2026)", url: "https://secure.businesswire.com/news/home/20260724814103/en/Berkshire-Hathaway-Completes-Acquisition-of-Taylor-Morrison" }]
    },

    // ---------------- Regional private builders ----------------
    {
      key: "stanleymartin", name: "Stanley Martin Homes", aliases: ["Stanley Martin", "Daiwa House", "United Homes Group", "Windsor Homes"], type: "regional",
      tagline: "Reston builder owned by Daiwa House, growing fast through acquisitions",
      hq: "Reston, Virginia", ticker: "", website: "https://www.stanleymartin.com",
      vaOffices: "Reston headquarters; Northern Virginia, Fredericksburg and Richmond divisions",
      summary: "Founded in 1966 and owned by Japan's Daiwa House Group since 2017, Stanley Martin says it has built more than 40,000 homes across 18 metro areas in seven states. It bought Windsor Homes' assets in late 2025 and closed a $221 million all-cash purchase of United Homes Group in May 2026, extending it across the Southeast. In July 2026 it agreed to buy Florida's Holiday Builders, adding more than 40 communities and about 10,600 controlled lots.",
      strategy: "Stanley Martin develops land as well as building homes. Its sale of a 190-acre Prince William County property to Amazon Data Services for about $700 million shows how data center demand can reprice residential land it controls.",
      numbers: [["Homes built since 1966", "40,000+"], ["Markets", "18 metro areas, 7 states"]],
      people: [{ name: "Steven B. Alloy", title: "President and CEO" }],
      projects: [],
      ownerPatterns: ["STANLEY MARTIN"], casePatterns: ["STANLEY MARTIN"],
      sources: [
        { label: "Virginia Business: Steven B. Alloy (2026)", url: "https://virginiabusiness.com/real-estate-2026-steven-b-alloy/" },
        { label: "HousingWire: Stanley Martin acquires UHG for $221M", url: "https://www.housingwire.com/articles/stanley-martin-acquires-uhg-221m/" },
        { label: "Builder: Stanley Martin acquires Holiday Builders (Jul 2026)", url: "https://www.builderonline.com/money/ma/stanley-martin-homes-acquires-florida-based-holiday-builders/" }
      ]
    },
    {
      key: "vanmetre", name: "Van Metre Companies", aliases: ["Van Metre"], type: "regional",
      tagline: "Fairfax-based builder, land developer and apartment owner since 1955",
      hq: "Fairfax, Virginia", ticker: "", website: "https://www.vanmetrecompanies.com",
      vaOffices: "Fairfax headquarters; Northern Virginia communities",
      summary: "Van Metre runs homebuilding, land development and investment properties across the Mid-Atlantic. In January 2026 CFO Mike Dunleavy became CEO after Rick Rabil retired, and the company split Van Metre Land and New Homes & Manufacturing into separate units, each with its own president reporting to the CEO.",
      strategy: "Because Van Metre has its own land unit, it buys and entitles raw land, not only finished lots.",
      numbers: [["Founded", "1955"]],
      people: [{ name: "Mike Dunleavy", title: "CEO (since Jan 2026; previously CFO)" }, { name: "Albert G. \"Beau\" Van Metre Jr.", title: "Chairman" }],
      projects: [{ name: "Niche at Villa Park", locality: "Springfield, Fairfax", detail: "Townhomes" }],
      ownerPatterns: ["VAN METRE"], casePatterns: ["VAN METRE"],
      sources: [{ label: "Van Metre names Mike Dunleavy CEO (Jan 2026)", url: "https://lifestyle.kbew98country.com/story/21488/van-metre-companies-appoints-mike-dunleavy-as-chief-executive-officer/" }]
    },
    {
      key: "christopher", name: "The Christopher Companies", aliases: ["Christopher Companies", "Christopher"], type: "regional",
      tagline: "Oakton builder of semi-custom communities since 1974",
      hq: "Oakton, Virginia", ticker: "", website: "https://www.christophercompanies.com",
      vaOffices: "Oakton headquarters",
      summary: "Christopher builds in Virginia, Maryland and Delaware with in-house design and a build-on-your-lot program. Current Northern Virginia communities include Haven at Woodway and Southern Oaks Reserve.",
      strategy: "Smaller, design-led communities and infill sites rather than large master plans.",
      numbers: [["Founded", "1974"]],
      people: [{ name: "John Regan", title: "CEO" }],
      projects: [{ name: "Haven at Woodway", locality: "Northern Virginia" }, { name: "Southern Oaks Reserve", locality: "Northern Virginia" }],
      ownerPatterns: ["CHRISTOPHER COMPAN", "CHRISTOPHER MANAGEMENT"], casePatterns: ["CHRISTOPHER"],
      sources: [{ label: "The Christopher Companies: About", url: "https://www.christophercompanies.com/about-us/" }]
    },
    {
      key: "millersmith", name: "Miller and Smith", aliases: ["Miller and Smith", "Miller & Smith"], type: "regional",
      tagline: "McLean builder of 60+ years, now expanding into Richmond",
      hq: "McLean, Virginia", ticker: "", website: "https://www.millerandsmith.com",
      vaOffices: "McLean headquarters; Richmond market added in 2024",
      summary: "Founded in 1964, Miller and Smith has built roughly 6,500 single-family homes, 10,000 townhomes and 2,100 condos in about 150 communities across Virginia, Maryland and Delaware. It entered Richmond with Sadler Square in Short Pump: 130 single-family homes on 33 acres off Glasgow Road, a site it spent eight years assembling.",
      strategy: "Patient land assembly: Sadler Square shows a willingness to piece together parcels over years. Its longtime VP of Land Development, Robert Spalding, retired in 2025.",
      numbers: [["Founded", "1964"], ["Homes built", "about 18,600 across 150 communities"]],
      people: [{ name: "Steven Aylor", title: "President" }, { name: "Tracy Lamb", title: "Vice President of Sales" }],
      projects: [{ name: "Sadler Square", locality: "Short Pump, Henrico", detail: "130 single-family homes on 33 acres", status: "Building" }],
      ownerPatterns: ["MILLER AND SMITH", "MILLER & SMITH"], casePatterns: ["MILLER AND SMITH", "MILLER & SMITH"],
      sources: [
        { label: "Miller and Smith breaks ground on Sadler Square (Nov 2024)", url: "https://www.barchart.com/story/news/29539144/miller-smith-breaks-ground-on-new-sadler-square-community-in-short-pump-va-celebrating-60-years-of-homebuilding-miller-smith-expands-into-richmond-market" },
        { label: "Miller and Smith announces Robert Spalding's retirement (Aug 2025)", url: "https://markets.financialcontent.com/pennwell.pennenergy/article/abnewswire-2025-8-6-miller-and-smith-announces-retirement-of-longtime-vice-president-of-land-development-robert-spalding" }
      ]
    },
    {
      key: "hhhunt", name: "HHHunt", aliases: ["HHHunt", "HH Hunt", "HHHunt Homes"], type: "regional",
      tagline: "Richmond and Blacksburg developer, homebuilder and apartment owner",
      hq: "Richmond (Henrico) and Blacksburg, Virginia", ticker: "", website: "https://www.hhhunt.com",
      vaOffices: "Henrico operations center; Blacksburg roots",
      summary: "HHHunt has been building since 1966 across homebuilding, apartments and senior living in Virginia and the Carolinas. Its biggest current Richmond project is The Aire at Westchester in Chesterfield: a 334-acre joint venture with landowner GrayCo at Midlothian Turnpike and Route 288, planned for about 2,200 homes and 180,000 square feet of commercial space.",
      strategy: "HHHunt develops large master plans itself and partners with landowners through joint ventures instead of buying everything outright.",
      numbers: [["Founded", "1966"]],
      people: [],
      projects: [{ name: "The Aire at Westchester", locality: "Chesterfield", detail: "334 acres, about 2,200 homes plus commercial; JV with GrayCo", status: "Phase I" }],
      ownerPatterns: ["HHHUNT", "HH HUNT"], casePatterns: ["HHHUNT", "HH HUNT", "AIRE AT WESTCHESTER"],
      sources: [{ label: "REBusiness: HHHunt and GrayCo plan 334-acre community (Mar 2024)", url: "https://rebusinessonline.com/hhhunt-grayco-to-develop-334-acre-master-planned-community-in-metro-richmond/" }]
    },
    {
      key: "stylecraft", name: "StyleCraft Homes", aliases: ["StyleCraft", "Stylecraft"], type: "regional",
      tagline: "Richmond-area builder of attainable townhome communities",
      hq: "Lakeside (Henrico), Virginia", ticker: "", website: "https://www.stylecrafthomes.com",
      vaOffices: "Henrico",
      summary: "StyleCraft's Crossings at Mulberry in Henrico is 160 townhomes on a 16-acre site bought for $1.6 million, with 25 homes in Henrico's Affordable Housing Trust Fund program and standard homes starting in the low $300,000s.",
      strategy: "Infill and attainable product near existing corridors, sometimes paired with county affordable-housing programs.",
      numbers: [], people: [],
      projects: [{ name: "The Crossings at Mulberry", locality: "Henrico", detail: "160 townhomes, 25 affordable", status: "Building" }],
      ownerPatterns: ["STYLECRAFT"], casePatterns: ["STYLECRAFT"],
      sources: [{ label: "Richmond BizSense: townhomes rising near Chamberlayne-Azalea (Apr 2025)", url: "https://richmondbizsense.com/2025/04/10/project-snapshot-new-townhomes-rising-near-chamberlayne-azalea-crossroads/" }]
    },
    {
      key: "chesapeakehomes", name: "Chesapeake Homes", aliases: ["Chesapeake Homes"], type: "regional",
      tagline: "Virginia Beach builder, one of the 100 largest in the country",
      hq: "Virginia Beach, Virginia", ticker: "", website: "https://www.chesapeakehomes.com",
      vaOffices: "Virginia Beach",
      summary: "Chesapeake Homes closed 631 homes for about $308 million in 2025 and ranked #90 on the 2026 Builder 100. Its 2025 mix was 477 detached for-sale homes, 110 single-family build-to-rent homes and 44 attached homes. Current communities include Edgewater, Meadows Landing and River Club in Suffolk and Walker Grove in Chesapeake.",
      strategy: "Broad product range from entry-level to active adult, with a build-to-rent line alongside for-sale homes.",
      numbers: [["Closings, 2025", "631"], ["Revenue, 2025", "about $308M"], ["Builder 100 rank, 2026", "#90"]],
      people: [{ name: "Kerri Woodward", title: "CEO" }],
      projects: [
        { name: "Edgewater", locality: "Suffolk", detail: "Single-family from about $450K" },
        { name: "Meadows Landing", locality: "Suffolk" },
        { name: "River Club, The Estates Collection", locality: "Suffolk" },
        { name: "Walker Grove", locality: "Chesapeake" }
      ],
      ownerPatterns: ["CHESAPEAKE HOMES"], casePatterns: ["CHESAPEAKE HOMES"],
      sources: [
        { label: "Builder: Chesapeake Homes profile", url: "https://www.builderonline.com/?p=109449" },
        { label: "NewHomeSource: Edgewater by Chesapeake Homes", url: "https://www.newhomesource.com/community/va/suffolk/edgewater-by-chesapeake-homes/222812" }
      ]
    },
    {
      key: "atlantic", name: "Atlantic Builders", aliases: ["Atlantic Builders"], type: "regional",
      tagline: "Fredericksburg-area builder for more than 35 years",
      hq: "Fredericksburg area, Virginia", ticker: "", website: "https://www.atlanticbuilders.com",
      vaOffices: "Fredericksburg region (Stafford, Spotsylvania, Fredericksburg)",
      summary: "Atlantic Builders is a privately owned regional builder in the Fredericksburg market. Its 55+ Afton Villas community off Mine Road launched presales in 2022 starting at $399,900, and its 2025 Give Back Home program raised $500,000 for local nonprofits.",
      strategy: "Local-market depth: single-family, villa and 55+ product along the I-95 corridor.",
      numbers: [],
      people: [{ name: "Tom Schoedel", title: "President" }],
      projects: [{ name: "Afton Villas", locality: "Fredericksburg", detail: "55+ attached villas" }],
      ownerPatterns: ["ATLANTIC BUILDERS"], casePatterns: ["ATLANTIC BUILDERS"],
      sources: [
        { label: "Potomac Local: Afton Villas presales", url: "https://www.potomaclocal.com/press-releases/atlantic-builders-announces-pre-sales-of-new-55-community-afton-villas-94/" },
        { label: "Potomac Local: Atlantic Builders donates $500K (Feb 2026)", url: "https://www.potomaclocal.com/2026/02/02/atlantic-builders-donates-500k-locally/" }
      ]
    },
    {
      key: "stateson", name: "Stateson Homes", aliases: ["Stateson"], type: "regional",
      tagline: "New River Valley builder (Blacksburg and Christiansburg)",
      hq: "Blacksburg area, Virginia", ticker: "", website: "",
      vaOffices: "Montgomery County",
      summary: "Stateson's listed communities include Westhill (villas, townhomes and single-family) in Blacksburg and Clifton Town Center in Christiansburg.",
      strategy: "", numbers: [], people: [],
      projects: [{ name: "Westhill", locality: "Blacksburg, Montgomery" }, { name: "Clifton Town Center", locality: "Christiansburg, Montgomery" }],
      ownerPatterns: ["STATESON"], casePatterns: ["STATESON"],
      sources: [{ label: "NewHomeSource: Westhill by Stateson Homes", url: "https://www.newhomesource.com/community/va/blacksburg/westhill-townhomes-by-stateson-homes/168348" }]
    },
    {
      key: "mainstreet", name: "Main Street Homes", aliases: ["Main Street Homes"], type: "regional",
      tagline: "Midlothian-based Richmond-area builder",
      hq: "Midlothian, Virginia", ticker: "", website: "",
      vaOffices: "Richmond region", summary: "", strategy: "", numbers: [], people: [], projects: [],
      ownerPatterns: ["MAIN STREET HOMES"], casePatterns: ["MAIN STREET HOMES"], sources: []
    },

    // ---------------- Land developers ----------------
    {
      key: "elmstreet", name: "Elm Street Communities (Elm Street Development)", aliases: ["Elm Street", "Elm Street Development", "Elm Street Communities"], type: "developer",
      tagline: "McLean master-plan developer since 1977",
      hq: "McLean, Virginia", ticker: "", website: "https://www.elmstreetdev.com",
      vaOffices: "McLean",
      summary: "Elm Street develops residential communities in Maryland, Virginia and D.C. and is expanding into Pennsylvania. It reports more than 300 communities and 52,000 homes, and it actively buys land across the Washington-Baltimore corridor, selling finished lots to builders.",
      strategy: "Classic land developer: buys raw land, entitles and develops it, and sells lots to builders such as NVR. That makes it both a competitor for raw land and a supplier to the public builders.",
      numbers: [["Founded", "1977"], ["Communities", "300+"]],
      people: [], projects: [],
      ownerPatterns: ["ELM STREET DEVELOPMENT", "ELM STREET COMMUNITIES", "ELM STREET DEV"], casePatterns: ["ELM STREET DEVELOPMENT", "ELM STREET COMMUNITIES"],
      sources: [{ label: "Elm Street Communities", url: "https://www.elmstreetdev.com/" }]
    },
    {
      key: "peterson", name: "The Peterson Companies", aliases: ["Peterson Companies", "Peterson"], type: "developer",
      tagline: "Fairfax developer behind Fairfax Corner, now building data center campuses",
      hq: "Fairfax, Virginia", ticker: "", website: "https://www.petersoncos.com",
      vaOffices: "Fairfax",
      summary: "Founded by Milt Peterson more than 60 years ago, Peterson develops retail, residential, office, industrial, self-storage and data centers. Its work includes Fairfax Corner, National Harbor in Maryland, the Fair Lakes redevelopment, and data center campuses in Stafford and Culpeper counties.",
      strategy: "Mixed-use and data center land is now a large part of its pipeline, which puts it in competition with homebuilders for big tracts near power and fiber.",
      numbers: [],
      people: [{ name: "Jon Peterson", title: "CEO" }, { name: "Daniel McCahan", title: "President" }],
      projects: [
        { name: "Fair Lakes redevelopment", locality: "Fairfax" },
        { name: "Data center campus", locality: "Stafford" },
        { name: "Data center campus", locality: "Culpeper" }
      ],
      ownerPatterns: ["PETERSON COMPANIES", "PETERSON COS", "MILTON PETERSON"], casePatterns: ["PETERSON"],
      sources: [{ label: "The Peterson Companies: About", url: "https://www.petersoncos.com/about/" }]
    },
    {
      key: "buchanan", name: "Buchanan Partners", aliases: ["Buchanan Partners", "Buchanan"], type: "developer",
      tagline: "Entitlement-driven developer of residential, industrial and land",
      hq: "Bethesda, Maryland", ticker: "", website: "https://www.buchananpartners.com",
      vaOffices: "Active in Prince William County",
      summary: "Founded in 1998, Buchanan reports more than 2,000 acres and 7,000 units entitled and $2 billion invested. In Virginia it entitled the Quartz District, a 145-acre mixed-use plan in Prince William County with 1,015 homes, and built Gainesville Industrial.",
      strategy: "Buchanan's edge is entitlement: it adds value by rezoning land and then builds, sells or partners.",
      numbers: [["Acres entitled", "2,000+"], ["Units entitled", "7,000+"]],
      people: [],
      projects: [{ name: "Quartz District", locality: "Prince William", detail: "145 acres, 1,015 homes" }, { name: "Gainesville Industrial", locality: "Prince William", detail: "121,672 sq ft warehouse" }],
      ownerPatterns: ["BUCHANAN PARTNERS"], casePatterns: ["BUCHANAN", "QUARTZ DISTRICT"],
      sources: [{ label: "Buchanan Partners", url: "https://www.buchananpartners.com/" }]
    },
    {
      key: "brookfield", name: "Brookfield Residential", aliases: ["Brookfield"], type: "developer",
      tagline: "Master-plan developer and builder; active at Potomac Shores",
      hq: "Calgary, Alberta", ticker: "", website: "https://www.brookfieldresidential.com",
      vaOffices: "Washington D.C. area",
      summary: "Brookfield joined Potomac Shores, SunCal's 1,920-acre master plan along the Potomac in Prince William County (planned for more than 3,800 homes), building alongside Pulte, NVHomes and Ryan Homes.",
      strategy: "Brookfield both develops master-planned land and builds homes.",
      numbers: [], people: [],
      projects: [{ name: "Potomac Shores", locality: "Prince William", detail: "SunCal master plan; Brookfield one of several builders" }],
      ownerPatterns: ["BROOKFIELD RESIDENTIAL", "BROOKFIELD HOMES"], casePatterns: ["BROOKFIELD"],
      sources: [{ label: "Builder: Brookfield, Pulte move into Potomac Shores", url: "https://www.builderonline.com/land/development/brookfield-pulte-move-into-potomac-shores_o" }]
    },
    {
      key: "trueland", name: "Trueland Development", aliases: ["Trueland"], type: "developer",
      tagline: "Northern Virginia land developer",
      hq: "Northern Virginia", ticker: "", website: "",
      vaOffices: "", summary: "Public details on Trueland are limited. Use your own contact notes below.", strategy: "", numbers: [], people: [], projects: [],
      ownerPatterns: ["TRUELAND"], casePatterns: ["TRUELAND"], sources: []
    },

    // ---------------- Contractors and engineers ----------------
    {
      key: "hazel", name: "William A. Hazel, Inc.", aliases: ["William A. Hazel", "Hazel", "W.A. Hazel"], type: "contractor",
      tagline: "Chantilly site development contractor since 1964",
      hq: "Chantilly, Virginia", ticker: "", website: "",
      vaOffices: "Chantilly",
      summary: "Hazel does total site development: clearing, earthwork, grading, water and sewer, storm drainage and roads across Northern Virginia and D.C. It is non-union, reports more than $50 million in annual revenue, and handles jobs up to about $50 million. Listed projects include Brambleton, Inova Fair Oaks Hospital and Sentara work.",
      strategy: "A site contractor's backlog shows which builders are about to deliver lots. Ask who they're grading for.",
      numbers: [["Founded", "1964"], ["Employees", "100 to 249"]],
      people: [], projects: [{ name: "Brambleton", locality: "Loudoun", detail: "Site work" }],
      ownerPatterns: ["WILLIAM A HAZEL", "W A HAZEL"], casePatterns: ["HAZEL"],
      sources: [{ label: "The Blue Book: William A. Hazel Inc.", url: "https://thebluebook.com/iProView/6159" }]
    },
    {
      key: "faulconer", name: "Faulconer Construction", aliases: ["Faulconer"], type: "contractor",
      tagline: "Civil contractor founded in 1946, based near Charlottesville",
      hq: "Louisa County, Virginia", ticker: "", website: "",
      vaOffices: "Charlottesville area",
      summary: "Faulconer is a full-service civil contractor working on transportation and wastewater infrastructure in Virginia and the Carolinas, such as the Valley Road sewer collector upgrade.",
      strategy: "", numbers: [["Founded", "1946"]],
      people: [{ name: "Jack Sanford", title: "CEO" }], projects: [],
      ownerPatterns: ["FAULCONER"], casePatterns: ["FAULCONER"],
      sources: [{ label: "Cvillepedia: Faulconer Construction Company", url: "https://www.cvillepedia.org/Faulconer_Construction_Company" }]
    },
    {
      key: "rinker", name: "Rinker Design Associates", aliases: ["Rinker", "RDA", "Trilon"], type: "contractor",
      tagline: "Manassas civil engineering and right-of-way firm (part of Trilon Group)",
      hq: "Manassas, Virginia", ticker: "", website: "",
      vaOffices: "Manassas and Fredericksburg",
      summary: "RDA provides civil engineering, land development design, surveying and right-of-way services, including VDOT work. It hires through Trilon Group, the engineering platform it belongs to.",
      strategy: "Engineers' names show up on rezoning and site plan files, so case searches can reveal which builders they design for.",
      numbers: [], people: [], projects: [],
      ownerPatterns: [], casePatterns: ["RINKER"],
      sources: []
    },
    {
      key: "bowman", name: "Bowman Consulting Group", aliases: ["Bowman"], type: "contractor",
      tagline: "Reston engineering firm being taken private for about $1 billion",
      hq: "Reston, Virginia", ticker: "BWMN", website: "https://www.bowman.com",
      vaOffices: "Reston headquarters and offices statewide",
      summary: "Bowman provides engineering and infrastructure consulting with more than 2,500 employees in about 100 offices and roughly $490 million of 2025 gross contract revenue. In August 2026 it agreed to be acquired by Bernhard Capital Partners for $43 a share (about $1 billion), expected to close in late 2026 or early 2027. Stockholders vote on the sale at a special meeting on November 4, 2026. Founder and CEO Gary Bowman plans to retire at year end.",
      strategy: "Land development engineering for many of the region's builders; its name appears on site plans and rezoning files.",
      numbers: [["Employees", "2,500+"], ["Gross contract revenue, 2025", "about $490M"]],
      people: [{ name: "Gary Bowman", title: "Founder and CEO (retiring end of 2026)" }], projects: [],
      ownerPatterns: [], casePatterns: ["BOWMAN"],
      sources: [
        { label: "Virginia Business: Bowman Consulting to be acquired for $1B (Aug 2026)", url: "https://virginiabusiness.com/bowman-consulting-to-be-acquired-for-1b/" },
        { label: "SEC: Bowman definitive merger proxy (Oct 5, 2026)", url: "https://www.sec.gov/Archives/edgar/data/0001847590/000114036126038492/ny20081613x2_defm14a.htm" }
      ]
    }
  ]
};
