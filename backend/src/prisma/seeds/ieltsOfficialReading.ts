/**
 * File: src/prisma/seeds/ieltsOfficialReading.ts
 * Purpose: Build official-structure IELTS Academic Reading assignment configs.
 * Why: Ensures seeds match 3 long passages, 40 substantive questions, and 60-minute timing.
 */
import type { Prisma } from "../generated.js";
import {
  buildTrueFalseNotGivenQuestion,
  nullAttempts,
  type IeltsFixtureVariant,
} from "./ieltsOfficialShared.js";

const QUESTION_DISTRIBUTION = [13, 13, 14] as const;

type ReadingQuestionDraft =
  | {
      type: "true_false_not_given";
      prompt: string;
      answer: "true" | "false" | "not_given";
    }
  | {
      type: "multiple_choice";
      prompt: string;
      options: [string, string, string, string];
      answer: string;
    };

const PASSAGES = [
  `Urban school estates have become a central test case for climate adaptation policy because they combine dense occupancy, aging infrastructure, and strict attendance obligations. Building surveys across Southern Europe and Southeast Asia show that midday classroom temperatures routinely exceed recommended comfort thresholds during prolonged heat events. In response, municipal authorities have shifted from emergency repairs toward multi-year retrofit programs that combine passive cooling, facade shading, and improved air circulation.

A recurring finding in comparative audits is that the most effective projects are not necessarily the most expensive. Schools that integrated external shading, operable windows, and reflective roofing often reported lower peak indoor temperatures than schools that relied on single-system mechanical upgrades. Engineers involved in these programs argue that layered interventions distribute thermal load more consistently across the day and reduce dependence on high-energy cooling.

Financing structures, however, influence what is actually delivered. Districts using annual grant cycles tend to prioritize low-disruption measures that can be installed during short holiday periods, while districts with dedicated resilience funds are more likely to reconfigure courtyards, insulation envelopes, and ventilation shafts. Project planners also note that sequencing decisions are political: schools serving examination cohorts are frequently scheduled first to minimize learning loss during high-stakes academic years.

Operational practice remains a decisive variable after construction. In several cities, post-occupancy data showed that performance gains declined within eighteen months when maintenance contracts were underfunded. Clogged filters, damaged louvres, and disabled sensors reduced system effectiveness despite sound initial design. By contrast, schools that adopted routine commissioning schedules and staff training maintained steadier indoor conditions and fewer weather-related timetable disruptions.

Community communication has emerged as another predictor of outcomes. Parent associations in high-performing districts were given transparent retrofit timelines and temporary room-allocation plans, which reduced resistance to phased works. Administrators report that predictable communication improved attendance during renovation periods and supported cooperation around temporary schedule adjustments.

Researchers caution against treating adaptation as a one-off capital project. They recommend continuous monitoring frameworks that combine temperature logging, maintenance reporting, and attendance data so decision-makers can identify whether physical upgrades are delivering educational resilience over time.`,
  `Public libraries have been recast as civic digital infrastructure in regions where household broadband, device ownership, and administrative literacy remain uneven. Field studies from Canada, the United Kingdom, and South Africa indicate that library demand has shifted from traditional lending peaks toward appointment-based support for online public services, job applications, and education portals. Librarians now describe routine workflows that include identity verification guidance, form navigation, and basic cybersecurity coaching.

This shift has required architectural and staffing redesign rather than simple service extension. Branches that once optimized for silent, long-duration reading have introduced mixed-use zones with privacy screens, charging points, and short-turnover workstations. Managers report that layout changes are most effective when paired with clear circulation rules, because ad-hoc workstation use can quickly crowd entrances and reduce accessibility for older patrons.

Temporal demand patterns are highly uneven. Usage records show sharp spikes around tax deadlines, university admissions windows, and welfare recertification cycles. Libraries that rely on walk-in support alone often experience queue spillover and higher error rates in completed forms. In contrast, systems that combine timed appointments with triage desks tend to process more users per day while preserving support quality for complex cases.

Workforce strategy is a second constraint. Specialist staff with strong digital-advising skills are limited, especially in smaller branches. Some systems have addressed this by rotating mobile advisory teams across neighborhoods or by building partnerships with community organizations that provide trained volunteers. Where these partnerships are formalized through shared protocols, branch-level service quality appears more consistent.

Policy analysts nevertheless warn that digital support expansion can displace core literacy programming if budgets remain static. Several municipalities reported declining capacity for language classes and youth reading clubs during rapid service reconfiguration. High-performing systems avoided this trade-off by tracking program-level outcomes and ring-fencing hours for non-digital educational services.

The broader lesson is that digital inclusion via libraries depends on governance as much as technology. Reliable service requires synchronized data standards, predictable staffing models, and explicit performance indicators that account for both transactional throughput and educational mission.`,
  `Coastal farming regions are increasingly exposed to salinity stress as sea-level rise, storm surges, and groundwater extraction alter soil and water chemistry. Agronomic research over the last decade has moved beyond simple yield comparison toward system-level resilience metrics, including season-to-season stability, input efficiency, and market viability. Trial networks in delta regions now compare salt-tolerant varieties under controlled and field conditions to identify combinations that remain productive under fluctuating salinity.

One strong finding is that varietal tolerance alone is insufficient. Plots that pair tolerant crops with rotation planning and drainage management outperform plots that treat seed choice as the only intervention. Researchers attribute this to cumulative effects: rotational design helps restore soil function, while drainage interventions reduce prolonged root-zone exposure during peak salinity periods.

Adoption pathways are strongly shaped by supply-chain realities. Farmers frequently cite irregular seed availability, uncertain procurement terms, and transport risk as barriers to experimentation. Cooperative purchasing schemes can reduce these barriers by pooling demand and securing more stable contracts, which lowers the financial penalty of trial failure for individual growers.

Market structure also influences agronomic decisions. Some growers report that buyers discount unfamiliar varieties even when nutritional profiles are comparable to conventional crops. Extension officers therefore emphasize pre-harvest coordination with traders and processors so cultivation trials are matched with realistic sales channels rather than evaluated in isolation.

Monitoring capacity is another dividing line between successful and unsuccessful adaptation programs. Districts with routine groundwater testing and field-level salinity logging tend to adjust planting calendars earlier, avoiding irreversible losses during late-season salinity spikes. Areas without regular monitoring often react only after visible crop stress, by which point recovery options are limited.

Training design matters as well. Programs that combine technical instruction with farmer-led demonstration plots generally achieve higher uptake than lecture-only outreach. Participants report greater confidence when they can compare outcomes in local conditions and discuss trade-offs with peers managing similar constraints.

Researchers conclude that coastal adaptation must be treated as an iterative management process linking seed systems, water governance, extension services, and market institutions. Without coordination across these domains, isolated interventions deliver short-lived gains but fail to secure long-term production resilience.`,
];

const QUESTION_BANK: Array<ReadingQuestionDraft[]> = [
  [
    { type: "true_false_not_given", prompt: "Comparative audits found that combining shading with ventilation reduced classroom heat more consistently than single-system upgrades.", answer: "true" },
    { type: "true_false_not_given", prompt: "The passage states that all retrofit projects were financed through dedicated long-term resilience funds.", answer: "false" },
    { type: "true_false_not_given", prompt: "The researchers reported national exam score improvements directly caused by retrofitting.", answer: "not_given" },
    { type: "true_false_not_given", prompt: "Underfunded maintenance contracts were linked to declining retrofit performance after implementation.", answer: "true" },
    { type: "true_false_not_given", prompt: "Schools with examination cohorts were often prioritised in retrofit sequencing decisions.", answer: "true" },
    { type: "multiple_choice", prompt: "Why do engineers in the passage support layered retrofit interventions?", options: ["They are always cheaper to install than any other method.", "They distribute thermal load and reduce reliance on one cooling mechanism.", "They remove the need for maintenance budgets.", "They eliminate political debate over sequencing."], answer: "They distribute thermal load and reduce reliance on one cooling mechanism." },
    { type: "multiple_choice", prompt: "What mainly distinguished schools that maintained long-term retrofit gains?", options: ["They hired only private contractors.", "They replaced all buildings with new campuses.", "They adopted commissioning routines and staff training.", "They paused lessons during summer months."], answer: "They adopted commissioning routines and staff training." },
    { type: "multiple_choice", prompt: "How did transparent communication with parents affect renovation phases?", options: ["It increased resistance to temporary room changes.", "It reduced attendance during construction periods.", "It improved cooperation and attendance stability.", "It removed the need for timetable adjustments."], answer: "It improved cooperation and attendance stability." },
    { type: "multiple_choice", prompt: "According to the passage, districts on annual grant cycles usually prioritised measures that", options: ["required major courtyard reconstruction.", "could be completed during short school breaks.", "depended on fully automated sensor networks.", "focused exclusively on exam-year classrooms."], answer: "could be completed during short school breaks." },
    { type: "multiple_choice", prompt: "What does the passage identify as a risk of treating adaptation as a one-off project?", options: ["Municipal audits become impossible to conduct.", "Temperature gains may not translate into sustained educational resilience.", "Schools lose eligibility for all maintenance funding.", "Parent groups disengage from school governance permanently."], answer: "Temperature gains may not translate into sustained educational resilience." },
    { type: "multiple_choice", prompt: "Which data sources are recommended for ongoing monitoring frameworks?", options: ["Only annual energy bills.", "Temperature logs, maintenance records, and attendance trends.", "Teacher recruitment statistics alone.", "National weather forecasts without local measurements."], answer: "Temperature logs, maintenance records, and attendance trends." },
    { type: "multiple_choice", prompt: "What is implied about highly expensive retrofit projects?", options: ["They were always less effective than low-cost projects.", "Cost alone did not guarantee the strongest outcomes.", "They were impossible to implement in public schools.", "They were rejected by all parent associations."], answer: "Cost alone did not guarantee the strongest outcomes." },
    { type: "multiple_choice", prompt: "The central argument of Passage 1 is that climate-resilient school retrofits are most successful when", options: ["construction decisions are isolated from operational planning.", "mechanical cooling is replaced entirely by passive systems.", "physical upgrades are integrated with maintenance and governance practices.", "projects are limited to schools in the hottest districts."], answer: "physical upgrades are integrated with maintenance and governance practices." },
  ],
  [
    { type: "true_false_not_given", prompt: "Library demand has shifted toward help with digital public services and online administration.", answer: "true" },
    { type: "true_false_not_given", prompt: "The passage claims that silent reading areas were removed from all redesigned branches.", answer: "false" },
    { type: "true_false_not_given", prompt: "Queue spillover was described as one reason walk-in-only support can reduce processing quality.", answer: "true" },
    { type: "true_false_not_given", prompt: "Every municipality in the study ring-fenced budgets for literacy programs before expanding digital services.", answer: "false" },
    { type: "true_false_not_given", prompt: "The passage gives exact hourly staffing ratios for each branch type.", answer: "not_given" },
    { type: "multiple_choice", prompt: "What practical change accompanied workstation expansion in many branches?", options: ["Removal of accessibility features.", "Introduction of privacy screens and controlled circulation.", "Replacement of appointment systems with open seating.", "Reduction in charging infrastructure to lower electricity costs."], answer: "Introduction of privacy screens and controlled circulation." },
    { type: "multiple_choice", prompt: "Why do appointment and triage models perform better during demand peaks?", options: ["They eliminate the need for specialist staff.", "They increase user throughput while preserving support quality.", "They prevent all form-completion errors.", "They allow branches to stop offering walk-in help entirely."], answer: "They increase user throughput while preserving support quality." },
    { type: "multiple_choice", prompt: "How have some systems addressed shortages of specialist digital-advising staff?", options: ["By rotating mobile advisory teams and formal volunteer partnerships.", "By limiting services to university students only.", "By outsourcing all support to private internet providers.", "By reducing opening hours in high-demand branches."], answer: "By rotating mobile advisory teams and formal volunteer partnerships." },
    { type: "multiple_choice", prompt: "What trade-off did policy analysts warn about when budgets stayed static?", options: ["Loss of all device infrastructure.", "Displacement of literacy and language programming.", "Inability to process any government forms.", "Closure of all rural branches."], answer: "Displacement of literacy and language programming." },
    { type: "multiple_choice", prompt: "Which strategy helped high-performing systems avoid program displacement?", options: ["Focusing only on transactional throughput.", "Tracking outcomes and protecting non-digital education hours.", "Reducing staff training to cut costs.", "Restricting services to appointment holders."], answer: "Tracking outcomes and protecting non-digital education hours." },
    { type: "multiple_choice", prompt: "What broader conclusion does Passage 2 reach about digital inclusion through libraries?", options: ["Technology upgrades alone are sufficient.", "Success depends on governance, staffing, and performance design.", "Library-based inclusion is inherently temporary.", "Digital services should replace all educational programming."], answer: "Success depends on governance, staffing, and performance design." },
    { type: "multiple_choice", prompt: "Demand spikes were associated with periods such as", options: ["seasonal tourism festivals.", "tax deadlines and admissions windows.", "library building inspections.", "major fiction book launches."], answer: "tax deadlines and admissions windows." },
    { type: "multiple_choice", prompt: "The passage presents libraries primarily as", options: ["commercial technology hubs competing with private providers.", "civic institutions balancing digital support with educational mission.", "temporary substitutes for schools and universities.", "spaces where traditional lending is no longer relevant."], answer: "civic institutions balancing digital support with educational mission." },
  ],
  [
    { type: "true_false_not_given", prompt: "The passage argues that seed tolerance alone does not guarantee resilient coastal production.", answer: "true" },
    { type: "true_false_not_given", prompt: "Rotation planning and drainage management were associated with stronger plot performance.", answer: "true" },
    { type: "true_false_not_given", prompt: "All farmers in trial districts had reliable access to salt-tolerant seed markets.", answer: "false" },
    { type: "true_false_not_given", prompt: "Buyer discounts on unfamiliar crops were identified as a barrier to adoption.", answer: "true" },
    { type: "true_false_not_given", prompt: "Groundwater monitoring removed the need to adjust planting calendars.", answer: "false" },
    { type: "true_false_not_given", prompt: "The researchers stated that lecture-only outreach consistently outperformed demonstration plots.", answer: "false" },
    { type: "multiple_choice", prompt: "Why are cooperative purchasing schemes important in the passage?", options: ["They replace agronomic testing requirements.", "They spread trial risk and stabilize procurement conditions.", "They guarantee premium prices for all varieties.", "They remove the need for extension services."], answer: "They spread trial risk and stabilize procurement conditions." },
    { type: "multiple_choice", prompt: "What is a key disadvantage of areas without routine salinity monitoring?", options: ["They cannot access any crop insurance products.", "They respond only after severe stress signs appear.", "They are unable to use rotational planting.", "They must abandon groundwater use immediately."], answer: "They respond only after severe stress signs appear." },
    { type: "multiple_choice", prompt: "How did farmer-led demonstration plots influence training outcomes?", options: ["They reduced confidence by exposing too many variables.", "They increased uptake by showing local trade-offs in practice.", "They eliminated differences between soil types.", "They made extension officers unnecessary."], answer: "They increased uptake by showing local trade-offs in practice." },
    { type: "multiple_choice", prompt: "According to Passage 3, adaptation planning should coordinate", options: ["only seed development and export policy.", "water governance, extension support, market pathways, and seed systems.", "farmer subsidies without technical monitoring.", "storm forecasting and coastal tourism investment."], answer: "water governance, extension support, market pathways, and seed systems." },
    { type: "multiple_choice", prompt: "Why do extension officers emphasize coordination with traders and processors?", options: ["To prevent the need for soil testing.", "To ensure trial cultivation is linked to realistic sales channels.", "To replace cooperative purchasing programs.", "To simplify crop rotation planning."], answer: "To ensure trial cultivation is linked to realistic sales channels." },
    { type: "multiple_choice", prompt: "The passage uses the term 'iterative management process' to highlight that adaptation", options: ["must be repeated every week regardless of conditions.", "requires ongoing adjustment across connected systems.", "should be delegated entirely to central government.", "depends mainly on short-term emergency responses."], answer: "requires ongoing adjustment across connected systems." },
    { type: "multiple_choice", prompt: "Which statement best reflects the evidence base cited in Passage 3?", options: ["Single-season yield data is sufficient for policy decisions.", "System-level resilience metrics are increasingly used alongside yield.", "Most trials avoid field conditions because they are unreliable.", "Market viability is considered less important than laboratory outcomes."], answer: "System-level resilience metrics are increasingly used alongside yield." },
    { type: "multiple_choice", prompt: "The overall message of Passage 3 is that coastal agricultural resilience depends on", options: ["isolated technical fixes applied once.", "coordinated, data-informed, and market-aware adaptation pathways.", "rapid replacement of all existing crop varieties.", "uniform policies with no local customization."], answer: "coordinated, data-informed, and market-aware adaptation pathways." },
  ],
];

function toReadingQuestion(
  id: string,
  draft: ReadingQuestionDraft,
): Prisma.InputJsonObject {
  if (draft.type === "true_false_not_given") {
    return buildTrueFalseNotGivenQuestion(id, draft.prompt, draft.answer);
  }

  return {
    id,
    type: "multiple_choice",
    prompt: draft.prompt,
    options: draft.options,
    answer: draft.answer,
    correctAnswer: draft.answer,
  };
}

function buildSectionQuestions(
  sectionIndex: number,
  startNumber: number,
  variant: IeltsFixtureVariant,
): Prisma.InputJsonObject[] {
  const sectionQuestions = QUESTION_BANK[sectionIndex];
  return sectionQuestions.map((draft, offset) => {
    const questionNumber = startNumber + offset;
    const id = `reading-${variant}-p${sectionIndex + 1}-q${questionNumber}`;
    return toReadingQuestion(id, draft);
  });
}

function buildReadingConfig(variant: IeltsFixtureVariant): Prisma.InputJsonObject {
  let runningQuestionNumber = 1;
  const sections = QUESTION_DISTRIBUTION.map((count, sectionIndex) => {
    const questions = buildSectionQuestions(
      sectionIndex,
      runningQuestionNumber,
      variant,
    );
    if (questions.length !== count) {
      throw new Error(`Reading section ${sectionIndex + 1} question count mismatch`);
    }
    runningQuestionNumber += count;

    return {
      id: `reading-${variant}-section-${sectionIndex + 1}`,
      title: `Passage ${sectionIndex + 1}`,
      passage: PASSAGES[sectionIndex],
      questions,
    };
  });

  return {
    version: 1,
    timing: { enabled: true, durationMinutes: 60, enforce: false },
    instructions:
      "IELTS Academic Reading format: 3 passages and 40 questions. Complete all questions in 60 minutes.",
    attempts: nullAttempts,
    sections,
  };
}

export function buildReadingConfigOfficialFull(): Prisma.InputJsonObject {
  return buildReadingConfig("full");
}

export function buildReadingConfigOfficialLite(): Prisma.InputJsonObject {
  return buildReadingConfig("lite");
}
