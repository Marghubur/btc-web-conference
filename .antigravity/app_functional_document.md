# 📄 Web Application Page Documentation Generator (Code-Only)

## 🎯 Objective
Generate **clear, client-friendly documentation** for a **single page of a web application** using **only the application source code**.

⚠️ **No UI screenshots will be provided**.  
All understanding must come strictly from the supplied source code.

The output must be suitable for **sharing with non-technical stakeholders**.

---

## 📥 Input Provided
You will be given:
1. **Source code path(s)** related to a single page or feature, which may include:
   - Frontend files (HTML / CSS / JS / TS / React / Angular / Vue, etc.)
   - Backend files (Controllers, APIs, Services, Validators, Security configs)
   - Routing files
   - Configuration files (if relevant)

---

## 🧠 Instructions for the AI

### 🔍 Analysis Rules
- Analyze the **source code first and only**
- Derive page behavior based on:
  - Routes
  - Controllers
  - Components
  - Forms
  - API calls
  - Validation logic
  - Authentication / authorization checks

### 🚫 Strict Restrictions
- ❌ Do NOT assume UI elements that are not present in code
- ❌ Do NOT suggest improvements or refactoring
- ❌ Do NOT add features beyond what exists in code

### ✅ Expectations
- Keep explanations **simple, professional, and client-readable**
- If something is unclear:
  - Make a **reasonable inference**
  - Clearly mention it under **Assumptions & Limitations**

---

## 📑 Required Output Structure

### 1️⃣ Page Overview
Provide:
- **Page Name** (derived from route, component, or controller)
- **Module / Feature Name**
- **High-level description** of what this page does

---

### 2️⃣ Purpose of the Page
Explain:
- Why this page exists
- What business or user problem it solves
- What primary action(s) it enables

---

### 3️⃣ Who Can Use This Page
List:
- Applicable user roles (Guest, Authenticated User, Admin, etc.)
- Access rules inferred from:
  - Middleware
  - Guards
  - Security annotations
  - Authorization checks

---

### 4️⃣ When This Page Is Used
Describe:
- Typical workflows or scenarios where this page is accessed
- Entry points such as:
  - Routes
  - Redirects
  - Navigation logic
  - API-triggered flows
- Preconditions (e.g., user must be logged in or logged out)

---

### 5️⃣ Fields and Controls on the Page
Derive fields from:
- Form definitions
- DTOs
- Request models
- Validation annotations

Provide details in the following table:

| # | Field / Control Name | Type (Input/Button/Link) | Mandatory | Description |
|---|---------------------|--------------------------|-----------|-------------|

Include:
- Form fields
- Buttons and actions
- Links or navigation triggers
- Third-party integrations (OAuth, Google login, etc.)

Also include:
- Validation rules
- Default values
- Error messages (if defined)

---

### 6️⃣ User Actions & Behavior
Explain:
- What actions a user can perform on this page
- What happens when each major action is triggered
- Success and failure scenarios as defined in code

---

### 7️⃣ Backend / System Interaction
Based on backend code:
- APIs invoked
- Request/response flow (high level)
- Authentication or authorization mechanisms
- Token, session, or cookie handling
- Redirect or navigation behavior after processing

---

### 8️⃣ Security & Compliance Notes (If Applicable)
Mention only what is visible in code:
- Password masking or encryption
- OAuth / SSO integration
- Remember-me functionality
- Session lifecycle handling
- Rate limiting or access guards

---

### 9️⃣ Assumptions & Limitations
Clearly document:
- Any assumptions made due to missing or indirect code references
- Any UI-related behavior inferred purely from backend or validation logic

---

### 🔟 Summary (Client-Friendly)
Provide a short, **non-technical summary** explaining:
- What this page does
- Who uses it
- Why it is important in the application

---

## 📌 Output Style Guidelines
- Use **simple English**
- Avoid technical jargon unless absolutely necessary
- Prefer bullet points and tables
- Maintain a **professional and neutral tone**

---

## ✅ Final Deliverable
- Generate a **well-structured Markdown document**
- Save the output to the following location:


Save your output in a file to location: `document/{place-file-name}.md`