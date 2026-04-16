## Problem Statement / Idea 
 
 IAM (Identity and Access Management) in cloud environments like AWS is a complex, often unreadable web of permissions, roles, and trust relationships. Security teams struggle to answer a critical question: **"If this identity is compromised, what can an attacker actually reach?"**
 
 - **What is the problem?** Traditional IAM analysis tools often provide static lists of permissions rather than actionable intelligence on privilege escalation paths, blast radius, and crown-jewel exposure.
 - **Why is it important?** Undetected permission chains and trust relationships can lead to massive data breaches and "full admin" compromises through subtle escalation paths.
 - **Who are the target users?** Cloud Security Engineers, DevSecOps Teams, Security Architects, and Penetration Testers.
 
 --- 
 
 ## Proposed Solution 
 
 **IAM Blast Radius Simulator** is an interactive, graph-based security intelligence tool that converts complex IAM topology into a live, actionable attack graph.
 
 - **What are you building?** An attack-graph abstraction engine that models the topology of trust and permission chains to identify privilege escalation paths and sensitive asset exposure.
 - **How does it solve the problem?** By visualizing the environment as a directed graph, it allows users to run automated traversal analyses from any identity, identifying exactly how far an attacker can move through the network.
 - **What makes your solution unique?** It features "What-if" remediation simulation (interactively removing permissions to see risk reduction), attack replay animations for educational value, and a natural language assistant for querying identity exposure in plain English.
 
 --- 
 
 ## Features 
 
 - **Attack Graph Visualization:** Color-coded nodes and severity-weighted edges representing the entire IAM landscape.
 - **Blast Radius Analysis:** Automated graph traversal to compute reachable assets, risk scores (0-100), and administrator reachability.
 - **Privilege Escalation Enumeration:** Identification and ranking of all escalation paths to high-value targets, tagged with MITRE ATT&CK tactics.
 - **Remediation Simulation (What-if):** Interactively disable permissions or trust relationships to see real-time percentage drops in risk.
 - **Attack Replay & Animations:** Step-by-step or auto-play visualizations of how an attacker would move through the graph.
 - **Natural Language Search:** A dedicated assistant to query identity risks using plain English (e.g., "What happens if this Lambda role is leaked?").
 - **IAM Snapshot Import:** Ability to upload custom JSON snapshots of IAM environments for instant attack-graph generation.
 
 --- 
 
 ## Tech Stack 
 
 - **Frontend:** React 19, TypeScript, Tailwind CSS v4, React Flow, Framer Motion
 - **Backend:** FastAPI (Python), NetworkX (Graph Engine), Pydantic
 - **Database:** In-memory storage with JSON-based mock scenarios
 - **APIs / Services:** RESTful API with JSON transport
 - **Tools / Libraries:** Docker Compose, Nginx, Uvicorn, Vite
 
 --- 
 
 ## Project Setup Instructions 
 
 Provide clear steps to run your project: 
 
 ```bash 
 # Clone the repository 
 git clone <repo-link> 
 
 # Install and run Backend
 cd backend
 pip install -r requirements.txt
 uvicorn main:app --reload --host 127.0.0.1 --port 8000

 # Install and run Frontend
 cd frontend
 npm install
 npm run dev
 
 # Alternative: Run with Docker Compose
 docker compose up --build
 ```
