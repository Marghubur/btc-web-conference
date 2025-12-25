# 📄 Login Page Documentation

---

## 1️⃣ Page Overview

| Attribute            | Details                                                      |
|----------------------|--------------------------------------------------------------|
| **Page Name**        | Login Page (derived from `LoginComponent`)                   |
| **Module / Feature** | Authentication                                               |
| **Description**      | User authentication page for the Confeet video conferencing application |

---

## 2️⃣ Purpose of the Page

- **Why it exists:** Provides user authentication functionality for the Confeet application
- **Business problem solved:** Securely verifies user identity before granting access to the conferencing platform
- **Primary actions enabled:**
  - User sign-in with email and password
  - Social login via Google
  - Credential persistence (Remember Me)

---

## 3️⃣ Who Can Use This Page

| User Role      | Access Level                           |
|----------------|----------------------------------------|
| Guest User     | Full access (unauthenticated users)    |

**Access Rules (from code):**
- No guards or middleware restrictions found in component code
- Page is accessible to any unauthenticated user
- Successful login redirects to Dashboard (indicating authentication is a prerequisite for other pages)

---

## 4️⃣ When This Page Is Used

**Workflows:**
- Initial application access
- Session expiration requiring re-authentication
- User logout followed by new login

**Entry Points:**
- Route: Defined in routing configuration (component selector: `app-login`)
- Navigation service (`iNavigation`) handles post-login redirect

**Preconditions:**
- User should not be currently authenticated
- On initialization, checks `localStorage` for saved credentials

---

## 5️⃣ Fields and Controls on the Page

### Form Fields

| # | Field / Control Name | Type | Mandatory | Description |
|---|---------------------|------|-----------|-------------|
| 1 | Email Address | Input (email) | Yes | User's registered email address |
| 2 | Password | Input (password) | Yes | User's account password |
| 3 | Remember Me | Checkbox | No | Saves credentials to localStorage for future logins |

### Buttons

| # | Control Name | Type | Description |
|---|--------------|------|-------------|
| 4 | Sign in with Google | Button | Social login option (no backend integration in component) |
| 5 | Sign In | Button | Submits login form; disabled during loading state |
| 6 | Password Visibility Toggle | Icon Button | Toggles password field between masked and visible |

### Links

| # | Control Name | Type | Description |
|---|--------------|------|-------------|
| 7 | Forgot Password? | Link | Non-functional (`javascript:void(0)`) |
| 8 | Create Account | Link | Non-functional (`javascript:void(0)`) |
| 9 | Privacy | Link | Footer link (`#`) |
| 10 | Terms | Link | Footer link (`#`) |
| 11 | Help | Link | Footer link (`#`) |

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Email | Required | "Email is required" |
| Email | Format: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | "Please enter a valid email address" |
| Password | Required | "Password is required" |

### Default Values

| Field | Default Value |
|-------|---------------|
| `email` | Empty string (`""`) or loaded from `localStorage` |
| `password` | Empty string (`''`) or loaded from `localStorage` |
| `rememberMe` | `false` (or `true` if credentials exist in storage) |
| `passwordType` | `"password"` (masked) |

---

## 6️⃣ User Actions & Behavior

### Sign In Action

| Trigger | Behavior |
|---------|----------|
| Click "Sign In" button | Sets `isSubmitted = true`, validates fields |
| Press Enter in password field | Triggers `login()` method |

**Success Flow:**
1. `HttpService.login()` called with `auth/authenticateUser` endpoint
2. If `ResponseBody` exists in response → navigate to Dashboard
3. If `rememberMe` is checked → save credentials to `localStorage`
4. If `rememberMe` is unchecked → remove credentials from `localStorage`

**Failure Flow:**
1. Exception caught in Promise `.catch()`
2. `isLoading` set to `false`
3. User remains on login page (no error message displayed)

### Password Toggle Action

| Current State | After Click |
|---------------|-------------|
| `passwordType = 'password'` | Changes to `'text'` (visible) |
| `passwordType = 'text'` | Changes to `'password'` (masked) |

### Page Initialization (`ngOnInit`)

1. Check `localStorage` for key `creds`
2. If exists: parse JSON, populate `email` and `password`, set `rememberMe = true`

---

## 7️⃣ Backend / System Interaction

### API Invoked

| Endpoint | HTTP Method | Purpose |
|----------|-------------|---------|
| `auth/authenticateUser` | POST (via `HttpService.login()`) | User authentication |

### Request Payload

```typescript
{
  email: string,
  password: string
}
```

### Response Handling

| Response Condition | Action |
|--------------------|--------|
| `res.ResponseBody` exists | Navigate to Dashboard |
| Exception thrown | Set `isLoading = false` |

### Navigation

| Scenario | Destination |
|----------|-------------|
| Successful authentication | `Dashboard` constant (via `iNavigation.navigate()`) |

### Token/Session Handling

- Handled by `HttpService` (not visible in component code)
- Component does not directly manage tokens or sessions

---

## 8️⃣ Security & Compliance Notes

| Feature | Status | Details |
|---------|--------|---------|
| Password Masking | ✅ Implemented | Default `type="password"`, toggle available |
| Remember Me | ⚠️ Security Concern | Credentials stored as **plain text JSON** in `localStorage` |
| OAuth / Google SSO | 🔲 UI Only | Button exists in HTML, no handler in component |
| Session Handling | External | Managed by `HttpService` |
| Rate Limiting | Not Found | No rate limiting logic in component |
| Access Guards | Not Found | No Angular guards applied to component |

---

## 9️⃣ Assumptions & Limitations

### Assumptions

1. **HttpService handles JWT tokens** — Component delegates authentication token management to the service layer
2. **Dashboard constant defines redirect route** — Imported from `models/constant`
3. **iNavigation service handles Angular routing** — Abstraction over Angular Router

### Limitations

1. **Google Sign-In not functional** — Button rendered in HTML but no click handler or OAuth integration exists in component
2. **Microsoft Sign-In commented out** — HTML contains commented section for Microsoft login button
3. **Forgot Password not implemented** — Link uses `javascript:void(0)` with no action
4. **Create Account not implemented** — Link uses `javascript:void(0)` with no action
5. **No user-facing error messages** — Login failures are caught silently with no feedback displayed
6. **Plain text credential storage** — Remember Me feature stores unencrypted credentials

---

## 🔟 Summary (Client-Friendly)

The **Login Page** is the entry point for users to access the Confeet video conferencing platform.

**What it does:**
- Allows users to sign in using their email address and password
- Offers a "Remember Me" option to save login details for convenience
- Provides a button for Google sign-in (feature pending implementation)

**Who uses it:**
- Any user who needs to access the conferencing application

**Why it's important:**
- Ensures only authorized users can access meetings, chats, and collaboration features
- Provides a secure gateway to the application while maintaining ease of use

---

## 📎 Source Files Analyzed

| File | Type | Purpose |
|------|------|---------|
| `login.component.html` | Template | UI structure and form layout |
| `login.component.ts` | Component | Logic, validation, and API integration |

---

*Document generated from source code analysis on: December 25, 2025*
