## Problem Statement / Idea 
 
 Identity and Access Management (IAM) in cloud environments is difficult to reason about in real time, especially after a user has already logged in. Security teams often know who authenticated, but they still struggle to answer two critical questions: **"Is this still the legitimate user?"** and **"If this identity is compromised, what can an attacker actually reach?"**
 
 - **What is the problem?** Traditional IAM analysis tools are usually static and permission-centric, while login security tools often stop at authentication. They do not continuously verify the user during the session, correlate behavioral drift with access activity, or connect identity risk to actual IAM blast radius.
 - **Why is it important?** A valid login does not guarantee a safe session. Account takeover, insider misuse, token theft, and privilege abuse can happen after login. Without continuous verification and live blast-radius visibility, attackers can move across sensitive services before defenders react.
 - **Who are the target users?** Cloud Security Engineers, DevSecOps Teams, SOC Analysts, Security Architects, IAM Review Teams, and Incident Response Teams.
 
 --- 
 
 ## Proposed Solution 
 
 **Agenticzero Zero Trust Platform** is an interactive cloud security console that combines continuous identity verification, live behavioral scoring, and IAM blast-radius analysis in one real-time system.
 
 - **What are you building?** A zero-trust platform that monitors post-login user behavior, scores sessions using a rule-based trust engine plus an RL-ready behavioral model, and maps risky identities into a live IAM attack graph.
 - **How does it solve the problem?** By continuously collecting session telemetry such as typing, mouse movement, route/resource access, API activity, device context, and data movement, the platform updates trust in real time and triggers passkey, face verification, restriction, or recovery flows when confidence drops. At the same time, it shows the user’s reachable blast radius and allows remediation simulation.
 - **What makes your solution unique?** It does not stop at anomaly scoring. It links continuous behavioral verification to actual IAM exposure, provides live overlays during the session, preserves existing safety controls, supports RL-model plug-in behavior, and turns identity compromise into a visible, actionable incident response workflow.
 
 --- 
 
 ## Features 
 
 - **Continuous Post-Login Verification:** Trust is evaluated throughout the session, not just at sign-in.
 - **RL-Ready Behavioral Scoring:** A built-in behavioral model scores live telemetry, and the architecture supports swapping in custom RL models.
 - **Live Session Overlay:** Authenticated pages show a movable, collapsible overlay with model score, risk, action, confidence, reasons, resources, and API activity.
 - **Rule-Based Safety Controls:** Existing passkey, face verification, restriction, and recovery policies remain intact and act as the final enforcement layer.
 - **Behavioral Telemetry Monitoring:** Tracks typing rhythm, mouse movement, scroll patterns, click behavior, route/resource novelty, device consistency, timezone drift, API activity, data volume, and privilege escalation attempts.
 - **IAM Blast Radius Visualization:** Displays identities, roles, permissions, and sensitive resources as an interactive graph.
 - **Reachability and Path Analysis:** Computes reachable entities, risk scores, critical paths, and hops-to-admin from any compromised identity.
 - **Remediation Simulation (What-if):** Allows risky permission paths to be severed and shows the effect on blast radius.
 - **Runtime IAM Activity Mapping:** Real session access is written into the graph so the incident view reflects current behavior, not just static topology.
 - **Admin Recovery Workflow:** Administrator compromise is handled with a recovery approval flow rather than standard user verification.
 - **Face Enrollment and Recovery Operations:** Admins can enroll faces, restore users, terminate sessions, and review live notifications.
 - **Hackathon Demo Controls:** Built-in demo scenarios make it easy to simulate suspicious IPs, geo drift, verification failures, and compromise states live.
 
 --- 
 
 ## Tech Stack 
 
 - **Frontend:** React 19, TypeScript, Tailwind CSS v4, Framer Motion, Socket.IO Client, Zustand, `@xyflow/react`, `face-api.js`, Vite
 - **Backend:** FastAPI (Python), NetworkX (Graph Engine), Pydantic v2, Python Socket.IO, JWT auth via `python-jose`
 - **Database:** In-memory session state with file-backed JSON persistence for users, IAM data, behavior profiles, behavior events, and RL model state
 - **APIs / Services:** RESTful API with real-time Socket.IO trust updates and telemetry ingestion
 - **Tools / Libraries:** Docker Compose, Nginx, Uvicorn, Vite
 
 --- 
 
 ## Project Setup Instructions 
 
 
 ```bash 
 # Clone the repository 
 git clone <repo-link> 
 cd hacktofuture4-C10
 
 # Install and run Backend
 cd backend
 pip install -r requirements.txt
 uvicorn main:app --reload --host 127.0.0.1 --port 8000

 # Install and run Frontend
 cd ../frontend
 npm install
 npm run dev
 
 # Alternative: Run with Docker Compose
 cd ..
 docker compose up --build
 ```
