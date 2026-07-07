# Capstone-project

## Lattice — QuantumConnect frontend

React (Vite) frontend for QuantumConnect, a marketplace connecting high-risk
organizations with verified post-quantum cryptography experts.

Implements the MVP user stories: sign up with a role, browse the verified
expert directory with filters, and view a full expert profile (credentials,
specializations, sector experience, engagement types).

### Run it

```bash
npm install
npm run dev
```

### Structure

- `src/pages` — routed pages (Landing, HowItWorks, SignUp, Login, ExpertDirectory, ExpertProfile)
- `src/components` — shared UI (Navbar, Footer, ExpertCard, badges)
- `src/api/client.js` — mock API mirroring `api-contract.md`
- `src/data/mockExperts.js` — fixture data shaped like the DB schema
- `src/context/AuthContext.jsx` — session state (localStorage-backed mock)
