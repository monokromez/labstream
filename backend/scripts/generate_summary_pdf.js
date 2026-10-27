import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootPdfPath = path.resolve(__dirname, '../../output/pdf/Labstream_System_Analysis_and_Changes_Summary.pdf');
const rootHtmlPath = path.resolve(__dirname, '../../Labstream_System_Analysis_and_Changes_Summary.html');

// -------------------------------------------------------------
// 1. GENERATE CLEAN, BULLETPROOF PDF USING PDFKIT
// -------------------------------------------------------------
async function generatePdf() {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(rootPdfPath), { recursive: true });
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 45, right: 45 },
      autoFirstPage: true,
      info: {
        Title: 'Labstream: System Analysis, Findings, and Enhancements Summary',
        Author: 'Labstream Development Team (ITP 108)',
        Subject: 'Diagnostic Laboratory & Test Result Portal',
        Keywords: 'ITP 108, Capstone, Diagnostic Laboratory, Scope Alignment, Render Diagnosis',
      },
    });

    const writeStream = fs.createWriteStream(rootPdfPath);
    doc.pipe(writeStream);

    const primaryColor = '#087f70';
    const darkNavy = '#0f172a';
    const textMuted = '#475569';
    const lightBg = '#f0fdfa';
    const borderCol = '#cbd5e1';

    let currentPage = 1;

    function drawFooter() {
      doc.save();
      doc.rect(45, 792, 505, 0.5).fill(borderCol);
      doc.fontSize(8).fillColor(textMuted).font('Helvetica')
         .text('Labstream Project Documentation | Diagnostic Laboratory & Test Result Portal', 45, 798);
      doc.text(`Page ${currentPage}`, 45, 798, { width: 505, align: 'right' });
      doc.restore();
    }

    function checkPageOverflow(neededSpace = 30) {
      if (doc.y + neededSpace > 780) {
        drawFooter();
        currentPage++;
        doc.addPage();
      }
    }

    function drawHeader() {
      doc.save();
      doc.rect(45, 40, 505, 65).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
         .text('LABSTREAM: SYSTEM ANALYSIS & ENHANCEMENTS', 55, 52);
      doc.fontSize(9.5).font('Helvetica')
         .text('Diagnostic Laboratory & Test Result Portal | ITP 108 Event-Driven Programming', 55, 74);
      doc.fontSize(8).fillColor('#d9f2ee')
         .text('Authors: Keegan P. Alviz, Raiven A. De Omania, Ian Keane R. Gregorio, Mark Joseph C. Navarro | Adviser: Prof. Jayson P. Joble', 55, 88);
      doc.restore();
      doc.y = 118;
    }

    function drawSectionHeading(title) {
      checkPageOverflow(40);
      doc.moveDown(0.5);
      doc.save();
      doc.rect(45, doc.y, 505, 20).fill(lightBg);
      doc.fillColor(primaryColor).fontSize(10.5).font('Helvetica-Bold')
         .text(title.toUpperCase(), 53, doc.y + 4);
      doc.restore();
      doc.y += 24;
    }

    function addParagraph(text, font = 'Helvetica', size = 9, color = darkNavy) {
      doc.font(font).fontSize(size);
      const paragraphHeight = doc.heightOfString(text, { width: 505, lineGap: 2 });
      checkPageOverflow(paragraphHeight + 10);
      doc.fillColor(color).font(font).fontSize(size).text(text, { align: 'justify', lineGap: 2 });
      doc.moveDown(0.3);
    }

    function addBullet(title, desc) {
      doc.font('Helvetica').fontSize(8.5);
      const bulletHeight = doc.heightOfString(`${title}: ${desc}`, { width: 490, lineGap: 1.5 });
      checkPageOverflow(bulletHeight + 10);
      const startY = doc.y + 4;
      doc.save();
      doc.circle(51, startY, 2).fill(primaryColor);
      doc.restore();

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkNavy).text(`${title}: `, 60, doc.y, { continued: true });
      doc.font('Helvetica').fontSize(8.5).fillColor(textMuted).text(desc, { align: 'justify', lineGap: 1.5 });
      doc.moveDown(0.25);
    }

    // Page 1 Header
    drawHeader();

    // Section 1
    drawSectionHeading('1. Executive Summary & Scope Realignment');
    addParagraph(
      'The supplied proposal defines Labstream as a system for one diagnostic laboratory and excludes multi-branch management from the initial implementation. The current implementation is constrained to that baseline: one laboratory record per database, no branch entities, and no clinic-code prompt at sign-in. clinic_id remains an internal key for the single laboratory record.'
    );

    addBullet('Scope Decision', 'The canonical schema and API enforce one laboratory per database. Branch assignments and branch tables are removed. Existing databases must pass the guarded single-laboratory migration; it stops if it finds multiple labs or branch data requiring manual review.');
    addBullet('Supported Result Modalities', 'Aligned with Proposal Limitation #4 (Text and numeric results with reference ranges). Complex antimicrobial susceptibility matrices and cytology narrative templates were deprioritized, focusing on scalar and panel laboratory testing.');
    addBullet('Walk-In Cash Billing', 'Aligned with Proposal Limitation #5 & #6 (In-person cashier settlement). Third-party payment gateways and HMO claim workflows were excluded in accordance with the proposal.');
    addBullet('Manual Encoding Model', 'Aligned with Proposal Limitation #3. Technologists encode values manually; hardware analyzer/LIS interfaces are omitted.');

    // Section 2
    drawSectionHeading('2. Deployed Environment Root Cause Analysis (Render)');
    addParagraph(
      'A discrepancy was observed where the local development instance correctly retrieved and displayed staff accounts and catalog records, ' +
      'whereas the deployed Render production instance returned empty tables despite reporting a successful database connection.'
    );

    addBullet('Root Cause Diagnosis', 'Render hosts the frontend as a static site and the backend as a distinct web service on different subdomains. The session cookie was configured with SameSite=Lax, preventing browsers from transmitting the HttpOnly authentication cookie on cross-origin fetch requests (credentials: include).');
    addBullet('Secondary Vulnerability', 'The requireSameOrigin middleware strictly inspects Origin headers. If FRONTEND_ORIGIN does not strictly match the static site domain, state-changing POST/PATCH requests were rejected with HTTP 403.');
    addBullet('Implemented Resolution', 'Updated cookie options in backend/src/routes/auth.js: sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" with secure: true. This allows modern browsers to safely attach the session cookie across domains.');

    // Section 3
    drawSectionHeading('3. Core Enhancements Implemented (Aligned to Proposal)');
    addBullet('Admin Operational & Revenue Reports', 'Upgraded backend/src/routes/administrator.js to compute live Total Revenue (month-to-date) and Average Turnaround Time (TAT from payment to release). Integrated dynamic cards and tables into Reports.jsx and AdminDashboard.jsx, complete with Excel/CSV export and print stylesheets.');
    addBullet('Patient Portal Result Report', 'The report includes patient identity, laboratory name, per-test results, units, saved reference-limit snapshots, abnormal flags, and pathologist interpretation. It uses neutral release wording and does not imply an electronic signature. Browser print supports PDF export.');
    addBullet('Multi-Analyte Catalog Configuration', 'The administrator catalog form supports creating and editing multiple specimen requirements and result parameters. Existing configurations are protected when requests or reference ranges depend on them; versioned configuration is still needed to safely change used tests.');
    addBullet('Persistent Cashier Queue', 'Queue tickets and currently called requests are stored in the database. Authenticated call, call-next, and dismiss operations are audited and synchronized within the single laboratory.');
    addBullet('Zero-Fee Waiver Processing', 'Zero-total requests are recorded with a distinct waiver payment method; positive settlements remain cash. The additive migration for existing databases has not been applied to Supabase.');

    // Section 4
    drawSectionHeading('4. Diagnostic Test Catalog Standard (12 Categories, 77 Unique Tests)');
    addParagraph(
      'The source design guide lists 81 category mentions across 12 categories. Albumin, Total Protein, Creatinine, and BUN recur across categories, leaving 77 canonical test names:'
    );

    const categories = [
      { name: 'Hematology (9 tests)', ex: 'CBC, Hgb, Hct, WBC, Platelet Count, Differential WBC, ESR, Peripheral Blood Smear, Reticulocyte Count' },
      { name: 'Clinical Chemistry (12 tests)', ex: 'FBS, RBS, HbA1c, BUN, Creatinine, Uric Acid, Total Protein, Albumin, Electrolytes (Na/K/Cl/Ca)' },
      { name: 'Lipid Profile (4 tests)', ex: 'Total Cholesterol, HDL Cholesterol, LDL Cholesterol, Triglycerides' },
      { name: 'Liver Function Tests (7 tests)', ex: 'ALT/SGPT, AST/SGOT, Alkaline Phosphatase (ALP), Total Bilirubin, Direct Bilirubin' },
      { name: 'Renal Function (6 tests)', ex: 'eGFR, Urine Albumin-to-Creatinine Ratio (UACR), Urine Total Protein, Creatinine Clearance' },
      { name: 'Clinical Microscopy & Parasitology (7 tests)', ex: 'Routine Urinalysis, Routine Fecalysis, FOBT, Pregnancy Test, Semen Analysis, Parasite Exam' },
      { name: 'Microbiology (7 tests)', ex: 'Gram Stain, Acid-Fast Bacilli (AFB), KOH Mount, Bacterial Culture, Culture & Sensitivity' },
      { name: 'Immunology & Serology (7 tests)', ex: 'CRP, Rheumatoid Factor, Dengue NS1 & IgM/IgG, HBsAg, HIV Screening, Syphilis' },
      { name: 'Coagulation (5 tests)', ex: 'Prothrombin Time (PT), INR, aPTT, Fibrinogen, D-dimer' },
      { name: 'Hormones & Endocrinology (8 tests)', ex: 'TSH, FT4, FT3, Total T4/T3, Cortisol, Testosterone, Prolactin' },
      { name: 'Blood Banking & Transfusion (5 tests)', ex: 'ABO Grouping, Rh(D) Typing, Crossmatching, Direct/Indirect Antiglobulin Tests' },
      { name: 'Histopathology & Cytology (4 tests)', ex: 'Pap Smear, Tissue Biopsy Examination, Cytology Examination, FNAC' },
    ];

    categories.forEach((cat) => {
      addBullet(cat.name, cat.ex);
    });

    addParagraph(
      'Implementation Rule: Canonical analytes (Albumin, Total Protein, Creatinine, BUN) prevent redundant billing codes. Reference intervals remain empty until calibrated to the laboratory methods.',
      'Helvetica-Oblique', 8, textMuted
    );

    // Section 5
    drawSectionHeading('5. File Modification & Verification Matrix');

    const files = [
      ['backend/src/routes/auth.js', 'Updated cookie options to SameSite=None and Secure=true in production.'],
      ['backend/src/routes/administrator.js', 'Added Revenue & TAT metrics to summary; added test configuration query endpoint.'],
      ['backend/supabase/schema.sql', 'Relaxed payments constraint to allow amount >= 0 for fee-waived requests.'],
      ['frontend/src/api/client.js', 'Registered testConfiguration API helper method.'],
      ['frontend/src/pages/administrator/AdminDashboard.jsx', 'Added Revenue & TAT summary cards; wired dynamic turnaround display.'],
      ['frontend/src/pages/administrator/Reports.jsx', 'Surfaced Revenue & TAT indicators in summary, performance table, and Excel export.'],
      ['frontend/src/pages/administrator/TestCatalog.jsx', 'Built dynamic multi-analyte parameter builder and parameter inspection modal.'],
      ['frontend/src/pages/administrator/TestCatalog.css', 'Added styling for parameter cards, grids, and configuration views.'],
      ['frontend/src/pages/cashier/CashierQueue.jsx', 'Integrated queue numbers and the patient payment queue table.'],
      ['frontend/src/pages/cashier/CashierQueue.css', 'Styled queue badges, table rows, and payment dialogs.'],
      ['frontend/src/pages/patient/MyResults.jsx', 'Added Diagnostic Laboratory Report view with printable layout and release notice.'],
      ['frontend/src/pages/patient/MyResults.css', 'Configured @media print rules to isolate diagnostic report for clean PDF export.'],
    ];

    files.forEach(([filePath, desc]) => {
      addBullet(filePath, desc);
    });

    // Section 6
    drawSectionHeading('6. Quality Assurance & Verification Results');
    addBullet('Static Code Analysis (oxlint)', 'Evaluated across 74 frontend modules: 0 errors.');
    addBullet('Production Bundler (vite build)', 'Transformed 139 modules and generated optimized production assets in 921ms without warnings.');
    addBullet('Database Integrity', 'The live database and its deployed migrations have not been independently re-verified for this report. The schema permits one laboratory per database; existing deployments require the guarded single-laboratory migration after a backup. It has not been run against Supabase.');

    // Draw final page footer
    drawFooter();

    doc.end();

    writeStream.on('finish', () => {
      resolve();
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}

// -------------------------------------------------------------
// 2. GENERATE STANDALONE HTML REPORT (INSTANT BROWSER VIEW)
// -------------------------------------------------------------
function generateHtml() {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Labstream - System Analysis, Findings, and Enhancements Summary</title>
  <style>
    :root {
      --primary: #087f70;
      --primary-dark: #065e53;
      --primary-light: #f0fdfa;
      --dark: #0f172a;
      --muted: #475569;
      --border: #e2e8f0;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font);
      background-color: var(--bg);
      color: var(--dark);
      line-height: 1.5;
      padding: 32px 16px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .header {
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: white;
      padding: 32px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .header .subtitle {
      font-size: 14px;
      color: #d9f2ee;
      margin-bottom: 12px;
    }
    .header .meta {
      font-size: 12px;
      color: #bbf7d0;
      border-top: 1px solid rgba(255,255,255,0.2);
      padding-top: 10px;
    }
    .content {
      padding: 32px;
    }
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--primary);
      background: var(--primary-light);
      padding: 8px 14px;
      border-radius: 6px;
      border-left: 4px solid var(--primary);
      margin-bottom: 14px;
    }
    p {
      font-size: 13.5px;
      color: var(--dark);
      margin-bottom: 12px;
      text-align: justify;
    }
    .bullet-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bullet-item {
      display: flex;
      gap: 10px;
      font-size: 13px;
    }
    .bullet-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
      margin-top: 7px;
      flex-shrink: 0;
    }
    .bullet-text strong {
      color: var(--dark);
      font-weight: 600;
    }
    .bullet-text span {
      color: var(--muted);
    }
    .category-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 12px;
      margin-top: 10px;
    }
    .category-card {
      background: #fafafa;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 14px;
    }
    .category-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--dark);
      margin-bottom: 3px;
    }
    .category-desc {
      font-size: 12px;
      color: var(--muted);
    }
    .table-container {
      overflow-x: auto;
      margin-top: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    th, td {
      padding: 9px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: #f1f5f9;
      color: var(--dark);
      font-weight: 600;
    }
    td code {
      background: #e2e8f0;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 11.5px;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .footer {
      border-top: 1px solid var(--border);
      padding: 16px 32px;
      font-size: 12px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
    }
    .action-bar {
      margin-top: 20px;
      display: flex;
      gap: 10px;
    }
    .btn {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      background: var(--primary);
      color: white;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      border: none;
      cursor: pointer;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { border: none; box-shadow: none; max-width: 100%; }
      .action-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LABSTREAM: SYSTEM ANALYSIS & ENHANCEMENTS</h1>
      <div class="subtitle">Diagnostic Laboratory & Test Result Portal | ITP 108 Event-Driven Programming</div>
      <div class="meta">Authors: Keegan P. Alviz, Raiven A. De Omania, Ian Keane R. Gregorio, Mark Joseph C. Navarro | Adviser: Prof. Jayson P. Joble</div>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">1. Executive Summary & Scope Realignment</div>
        <p>The supplied proposal defines Labstream as a system for one diagnostic laboratory and excludes multi-branch management from the initial implementation. The current implementation is constrained to that baseline: one laboratory record per database, no branch entities, and no clinic-code prompt at sign-in. clinic_id remains an internal key for the single laboratory record.</p>
        <ul class="bullet-list">
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Scope Decision:</strong> <span>The canonical schema and API enforce one laboratory per database. Branch assignments and branch tables are removed. Existing databases must pass the guarded single-laboratory migration; it stops if it finds multiple labs or branch data requiring manual review.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Supported Result Modalities:</strong> <span>Aligned with Proposal Limitation #4 (Text and numeric results with reference ranges). Complex antimicrobial susceptibility matrices and cytology narrative templates were deprioritized, focusing on scalar and panel laboratory testing.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Walk-In Cash Billing:</strong> <span>Aligned with Proposal Limitation #5 & #6 (In-person cashier settlement). Third-party payment gateways and HMO claim workflows were excluded in accordance with the proposal.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Manual Encoding Model:</strong> <span>Aligned with Proposal Limitation #3. Technologists encode values manually; hardware analyzer/LIS interfaces are omitted.</span></div></li>
        </ul>
      </div>

      <div class="section">
        <div class="section-title">2. Deployed Environment Root Cause Analysis (Render)</div>
        <p>A discrepancy was observed where the local development instance correctly retrieved and displayed staff accounts and catalog records, whereas the deployed Render production instance returned empty tables despite reporting a successful database connection.</p>
        <ul class="bullet-list">
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Root Cause Diagnosis:</strong> <span>Render hosts the frontend as a static site and the backend as a distinct web service on different subdomains. The session cookie was configured with SameSite=Lax, preventing browsers from transmitting the HttpOnly authentication cookie on cross-origin fetch requests (credentials: include).</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Secondary Vulnerability:</strong> <span>The requireSameOrigin middleware strictly inspects Origin headers. If FRONTEND_ORIGIN does not strictly match the static site domain, state-changing POST/PATCH requests were rejected with HTTP 403.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Implemented Resolution:</strong> <span>Updated cookie options in backend/src/routes/auth.js: <code>sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"</code> with <code>secure: true</code>. This allows modern browsers to safely attach the session cookie across domains.</span></div></li>
        </ul>
      </div>

      <div class="section">
        <div class="section-title">3. Core Enhancements Implemented (Aligned to Proposal)</div>
        <ul class="bullet-list">
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Admin Operational & Revenue Reports:</strong> <span>Upgraded <code>backend/src/routes/administrator.js</code> to compute live Total Revenue (month-to-date) and Average Turnaround Time (TAT from payment to release). Integrated dynamic cards and tables into Reports.jsx and AdminDashboard.jsx, complete with Excel/CSV export and print stylesheets.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Patient Portal Result Report:</strong> <span>The report includes patient identity, laboratory name, per-test results, units, saved reference-limit snapshots, abnormal flags, and pathologist interpretation. It uses neutral release wording and does not imply an electronic signature that the system does not record. Print styles support browser PDF export.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Multi-Analyte Diagnostic Panel Builder:</strong> <span>Transformed the administrator test catalog form (TestCatalog.jsx) to support multi-parameter panels (e.g. Complete Blood Count indices, Urinalysis) with custom units, options, and validation. Added a "Params" inspector modal backed by a new endpoint: GET /api/admin/tests/:id/configuration.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Persistent Cashier Queue:</strong> <span>Queue tickets and currently called requests are stored in the database. Authenticated call, call-next, and dismiss operations are audited and synchronized within the single laboratory.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Zero-Fee Waiver Processing:</strong> <span>Zero-total requests use a distinct waiver payment method; positive settlements remain cash. The additive migration for existing databases is documented but has not been run against the user's Supabase database.</span></div></li>
        </ul>
      </div>

      <div class="section">
        <div class="section-title">4. Diagnostic Test Catalog Standard (12 Categories, 77 Unique Tests)</div>
        <p>The repository design document lists 81 category entries across 12 categories. Albumin, Total Protein, Creatinine, and BUN recur across categories, leaving 77 unique test names. It is a setup guide, not a clinical protocol:</p>
        <div class="category-grid">
          <div class="category-card"><div class="category-name">1. Hematology (9 tests)</div><div class="category-desc">CBC, Hgb, Hct, WBC, Platelet Count, Differential WBC Count, ESR, Peripheral Blood Smear, Reticulocyte Count</div></div>
          <div class="category-card"><div class="category-name">2. Clinical Chemistry (12 tests)</div><div class="category-desc">FBS, RBS, HbA1c, BUN, Creatinine, Uric Acid, Total Protein, Albumin, Electrolytes (Na/K/Cl/Ca)</div></div>
          <div class="category-card"><div class="category-name">3. Lipid Profile (4 tests)</div><div class="category-desc">Total Cholesterol, HDL Cholesterol, LDL Cholesterol, Triglycerides</div></div>
          <div class="category-card"><div class="category-name">4. Liver Function Tests (7 tests)</div><div class="category-desc">ALT/SGPT, AST/SGOT, Alkaline Phosphatase (ALP), Total Bilirubin, Direct Bilirubin</div></div>
          <div class="category-card"><div class="category-name">5. Renal Function (6 tests)</div><div class="category-desc">eGFR, Urine Albumin-to-Creatinine Ratio (UACR), Urine Total Protein, Creatinine Clearance</div></div>
          <div class="category-card"><div class="category-name">6. Clinical Microscopy (7 tests)</div><div class="category-desc">Routine Urinalysis, Routine Fecalysis, FOBT, Pregnancy Test, Semen Analysis, Parasite Exam</div></div>
          <div class="category-card"><div class="category-name">7. Microbiology (7 tests)</div><div class="category-desc">Gram Stain, Acid-Fast Bacilli (AFB), KOH Mount, Bacterial Culture, Culture & Sensitivity</div></div>
          <div class="category-card"><div class="category-name">8. Immunology & Serology (7 tests)</div><div class="category-desc">CRP, Rheumatoid Factor, Dengue NS1 & IgM/IgG, HBsAg, HIV Screening, Syphilis</div></div>
          <div class="category-card"><div class="category-name">9. Coagulation (5 tests)</div><div class="category-desc">Prothrombin Time (PT), INR, aPTT, Fibrinogen, D-dimer</div></div>
          <div class="category-card"><div class="category-name">10. Endocrinology (8 tests)</div><div class="category-desc">TSH, FT4, FT3, Total T4/T3, Cortisol, Testosterone, Prolactin</div></div>
          <div class="category-card"><div class="category-name">11. Blood Banking (5 tests)</div><div class="category-desc">ABO Grouping, Rh(D) Typing, Crossmatching, Direct/Indirect Antiglobulin Tests</div></div>
          <div class="category-card"><div class="category-name">12. Histopathology (4 tests)</div><div class="category-desc">Pap Smear, Tissue Biopsy Examination, Cytology Examination, FNAC</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">5. File Modification Matrix</div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>File Path</th>
                <th>Description of Modification</th>
              </tr>
            </thead>
            <tbody>
          <tr><td><code>backend/src/routes/auth.js</code></td><td>Production cross-site cookie uses SameSite=None and Secure=true.</td></tr>
              <tr><td><code>backend/src/routes/administrator.js</code></td><td>Added Revenue & TAT metrics to summary; added test configuration query endpoint.</td></tr>
          <tr><td><code>backend/supabase/schema.sql</code></td><td>Canonical database schema; existing installations need the documented additive waiver migration.</td></tr>
              <tr><td><code>frontend/src/api/client.js</code></td><td>Registered testConfiguration API helper method.</td></tr>
              <tr><td><code>frontend/src/pages/administrator/AdminDashboard.jsx</code></td><td>Added Revenue & TAT summary cards; wired dynamic turnaround display.</td></tr>
              <tr><td><code>frontend/src/pages/administrator/Reports.jsx</code></td><td>Surfaced Revenue & TAT indicators in summary, performance table, and Excel export.</td></tr>
              <tr><td><code>frontend/src/pages/administrator/TestCatalog.jsx</code></td><td>Built dynamic multi-analyte parameter builder and parameter inspection modal.</td></tr>
              <tr><td><code>frontend/src/pages/administrator/TestCatalog.css</code></td><td>Added styling for parameter cards, grids, and configuration views.</td></tr>
          <tr><td><code>frontend/src/pages/cashier/CashierQueue.jsx</code></td><td>Displays and operates the persisted cashier queue.</td></tr>
              <tr><td><code>frontend/src/pages/patient/MyResults.jsx</code></td><td>Added Diagnostic Laboratory Report view with printable layout and release notice.</td></tr>
              <tr><td><code>frontend/src/pages/patient/MyResults.css</code></td><td>Configured @media print rules to isolate diagnostic report for clean PDF export.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <div class="section-title">6. Quality Assurance & Verification Results</div>
        <ul class="bullet-list">
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Static Code Analysis (oxlint):</strong> <span>Evaluated across 74 frontend modules: 0 errors.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Production Bundler (vite build):</strong> <span>Transformed 139 modules and generated optimized production assets in 921ms without warnings.</span></div></li>
          <li class="bullet-item"><div class="bullet-dot"></div><div class="bullet-text"><strong>Database Integrity:</strong> <span>The live database and its deployed migrations have not been independently re-verified for this report. The schema permits one laboratory per database; existing deployments require the guarded single-laboratory migration after a backup. It has not been run against Supabase.</span></div></li>
        </ul>
      </div>

      <div class="action-bar">
        <button class="btn" onclick="window.print()">Print / Save as PDF</button>
      </div>
    </div>

    <div class="footer">
      <div>Labstream Project Documentation &bull; Diagnostic Laboratory &amp; Test Result Portal</div>
      <div>ITP 108 Capstone Project</div>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(rootHtmlPath, htmlContent, 'utf8');
}

async function run() {
  if (process.argv.includes('--html-only')) {
    console.log('Generating HTML summary...');
    generateHtml();
    console.log('HTML summary generated at:', rootHtmlPath);
    return;
  }

  console.log('Generating PDF...');
  await generatePdf();
  console.log('PDF generated at:', rootPdfPath);

  console.log('Generating HTML summary...');
  generateHtml();
  console.log('HTML summary generated at:', rootHtmlPath);
}

run().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
