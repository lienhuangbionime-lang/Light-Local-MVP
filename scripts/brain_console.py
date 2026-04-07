import os
import sys
import json
import time
import subprocess

# Fix Windows cp950 encoding issue BEFORE any other imports
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import gradio as gr
from dotenv import load_dotenv
from google import genai

# ─── Configuration ───────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAIN_DIR    = os.path.join(PROJECT_ROOT, "sync_brain")
SKILLS_DIR   = os.path.join(BRAIN_DIR, "skills")
ENV_PATH     = os.path.join(PROJECT_ROOT, ".env")
CHUB_CMD     = r"C:\Users\lien.huang\AppData\node\chub.cmd"

load_dotenv(ENV_PATH)
api_key = os.getenv("GEMINI_API_KEY")

# ─── Tools ───────────────────────────────────────────────────────────────────
def list_project_files(directory="."):
    """Lists files in the project directory."""
    target_dir = os.path.normpath(os.path.join(PROJECT_ROOT, directory))
    if not target_dir.startswith(os.path.normpath(PROJECT_ROOT)):
        return "Access Denied: Out of project root."
    try:
        return "\n".join(os.listdir(target_dir))
    except Exception as e:
        return str(e)

def read_project_file(rel_path):
    """Reads a project file."""
    target_path = os.path.normpath(os.path.join(PROJECT_ROOT, rel_path))
    if not target_path.startswith(os.path.normpath(PROJECT_ROOT)):
        return "Access Denied: Out of project root."
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return str(e)

def write_project_file(rel_path, content):
    """Writes or overwrites a project file."""
    target_path = os.path.normpath(os.path.join(PROJECT_ROOT, rel_path))
    if not target_path.startswith(os.path.normpath(PROJECT_ROOT)):
        return "Access Denied: Out of project root."
    if os.path.exists(target_path):
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                old = f.read()
            with open(target_path + ".bak", "w", encoding="utf-8") as f:
                f.write(old)
        except:
            pass
    try:
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"SUCCESS: Written to {rel_path}"
    except Exception as e:
        return f"ERROR: {str(e)}"

def run_shell_command(command):
    """Runs a safe shell command (git, python, pip, npm, node, chub only)."""
    SAFE_PREFIXES = ["git ", "python ", "pip ", "npm ", "node ", "chub "]
    if not any(command.strip().startswith(p) for p in SAFE_PREFIXES):
        return f"BLOCKED: Only allowed: {', '.join(SAFE_PREFIXES)}"
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True,
            text=True, encoding="utf-8", errors="replace",
            cwd=PROJECT_ROOT, timeout=30
        )
        out = result.stdout or ""
        err = result.stderr or ""
        return (out + ("\n[STDERR]\n" + err if err else "")).strip()
    except subprocess.TimeoutExpired:
        return "ERROR: Command timed out (30s)"
    except Exception as e:
        return f"ERROR: {str(e)}"

def fetch_api_docs(library_name, lang=None):
    """Fetches documentation for a library via Chub. If ambiguous, specify lang (e.g. 'python', 'javascript')."""
    if not os.path.exists(CHUB_CMD):
        return "Chub not installed. Run: npm install -g @aisuite/chub"
    
    def _run_chub(l_name, l_code=None):
        cmd = [CHUB_CMD, "get", l_name]
        if l_code: cmd.extend(["--lang", l_code])
        return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)

    try:
        result = _run_chub(library_name, lang)
        
        # Scenario 1: Multiple languages available
        if result.returncode != 0 and "Multiple languages available" in (result.stderr or "") and not lang:
            print(f"[CHUB] Ambiguity detected for {library_name}. Retrying with --lang python...")
            result = _run_chub(library_name, "python")

        # Scenario 2: Fatal crash with /package suffix
        if result.returncode != 0 and "/package" in library_name:
            stripped = library_name.replace("/package", "")
            print(f"[CHUB] Fatal error with /package. Retrying with {stripped}...")
            result = _run_chub(stripped, lang or "python")

        if result.returncode != 0:
            return f"CHUB ERROR (Code {result.returncode}): {result.stderr or result.stdout}\nTip: Try 'npm install -g @aisuite/chub' to update."
        return result.stdout or "No docs returned."
    except Exception as e:
        return f"TOOL CRASH: {str(e)}"

# ─── Chub / OpenClaw Skill Discovery ─────────────────────────────────────────
def query_chub_skills(query=""):
    """Query Chub for available skills/docs."""
    if not os.path.exists(CHUB_CMD):
        return []
    try:
        cmd = [CHUB_CMD, "search", "--json"] if not query.strip() else [CHUB_CMD, "search", query.strip(), "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True,
                                encoding="utf-8", errors="replace", timeout=20)
        data = json.loads(result.stdout)
        return data.get("results", [])
    except Exception:
        return []

def get_local_skills():
    """Lists local sync_brain skills."""
    skills = []
    if os.path.exists(SKILLS_DIR):
        for f in os.listdir(SKILLS_DIR):
            if f.endswith(".md"):
                full_path = os.path.join(SKILLS_DIR, f)
                try:
                    with open(full_path, "r", encoding="utf-8") as fp:
                        content = fp.read()
                    skills.append({"name": f.replace(".md", ""), "path": full_path, "preview": content})
                except:
                    pass
    return skills

def format_skill_choices(chub_results, local_skills):
    choices = []
    for s in local_skills:
        choices.append(f"[LOCAL] {s['name']}")
    for r in chub_results[:15]:
        choices.append(f"[CHUB] {r.get('id', r.get('name', '?'))}")
    return choices

def load_skill_content(skill_label):
    if not skill_label or skill_label == "(None)":
        return ""
    if skill_label.startswith("[LOCAL]"):
        name = skill_label.replace("[LOCAL] ", "")
        path = os.path.join(SKILLS_DIR, name + ".md")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return "Skill file not found."
    elif skill_label.startswith("[CHUB]"):
        lib_id = skill_label.replace("[CHUB] ", "")
        return fetch_api_docs(lib_id)
    return ""

# ─── AI Setup ────────────────────────────────────────────────────────────────
client = None
if api_key:
    client = genai.Client(api_key=api_key)
else:
    print("[ERROR] GEMINI_API_KEY not found in .env")

def load_brain_context():
    context = ""
    file_list = []
    if not os.path.exists(BRAIN_DIR):
        return "No sync_brain directory found.", []
    for root, dirs, files in os.walk(BRAIN_DIR):
        for file in files:
            if file.endswith((".md", ".json")):
                rel_base = os.path.relpath(root, BRAIN_DIR)
                rel_file = os.path.join(rel_base, file) if rel_base != "." else file
                file_list.append(rel_file)
                try:
                    with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                        content = f.read()
                    context += f"\n--- [{rel_file.upper()}] ---\n{content}\n"
                except:
                    pass
    return context, file_list

# --- TOOL MAP for Manual Execution ---
TOOL_MAP = {
    "list_project_files": list_project_files,
    "read_project_file": read_project_file,
    "write_project_file": write_project_file,
    "run_shell_command": run_shell_command,
    "fetch_api_docs": fetch_api_docs
}

def chat_with_brain(message, history, active_skill_content=""):
    if not client:
        return "Error: GEMINI_API_KEY not found in .env"
    
    context, _ = load_brain_context()

    skill_section = ""
    if active_skill_content:
        skill_section = f"\n\n===ACTIVE SKILL SOP===\n{active_skill_content}\n===END SKILL===\n"

    system_prompt = (
        "You are the Agentic Brain for the 'Local-First MVP' project (v3.0).\n"
        "You have access to the following TOOLS. If you need to use one, output a JSON block like this:\n"
        "```tool_call\n{\"name\": \"tool_name\", \"args\": {\"arg1\": \"val1\"}}\n```\n\n"
        "TOOLS:\n"
        "- list_project_files(directory='.')\n"
        "- read_project_file(rel_path)\n"
        "- write_project_file(rel_path, content)\n"
        "- run_shell_command(command)\n"
        "- fetch_api_docs(library_name, lang=None)\n\n"
        "GUIDELINES:\n"
        "1. Always read a file before modifying it. Follow the active Skill SOP if loaded.\n"
        "2. If `fetch_api_docs` crashes or fails, check your local `sync_brain/skills/` context files first.\n"
        + skill_section
        + f"\nProject Context:\n{context[:9000]}"
    )

    contents = []
    # Convert history for Gemini API
    for h in (history or []):
        if h[0]: contents.append({"role": "user", "parts": [{"text": h[0]}]})
        if h[1]: contents.append({"role": "model", "parts": [{"text": h[1]}]})
    
    # Add system context to the first message or as system_instruction
    user_with_context = f"{system_prompt}\n\nUSER MESSAGE: {message}"
    contents.append({"role": "user", "parts": [{"text": user_with_context}]})

    MAX_ITERATIONS = 5
    full_output = ""
    
    for _ in range(MAX_ITERATIONS):
        try:
            response = client.models.generate_content(
                model=os.getenv("GEMINI_VISION_MODEL", "models/gemma-4-26b-it"),
                contents=contents
            )
            raw_text = response.text or ""
            full_output += raw_text + "\n"
            contents.append({"role": "model", "parts": [{"text": raw_text}]})

            # Check for tool call
            if "```tool_call" in raw_text:
                try:
                    # Extract JSON
                    json_str = raw_text.split("```tool_call")[1].split("```")[0].strip()
                    call_data = json.loads(json_str)
                    t_name = call_data.get("name")
                    t_args = call_data.get("args", {})
                    
                    if t_name in TOOL_MAP:
                        print(f"[EXECUTING TOOL] {t_name}(**{t_args})")
                        result = TOOL_MAP[t_name](**t_args)
                        result_msg = f"\n[TOOL RESULT: {t_name}]\n{result}\n"
                        contents.append({"role": "user", "parts": [{"text": result_msg}]})
                        continue # AI needs to see the result and continue
                except Exception as ex:
                    contents.append({"role": "user", "parts": [{"text": f"Error parsing tool call: {str(ex)}"}]})
                    continue
            
            # If no tool call or we finished the thought, return
            return raw_text
            
        except Exception as e:
            return f"Agent Error: {str(e)}"
    
    return full_output

# ─── Gradio UI ────────────────────────────────────────────────────────────────
_local_skills = get_local_skills()
_chub_results = query_chub_skills("")
_all_choices = ["(None)"] + format_skill_choices(_chub_results, _local_skills)

with gr.Blocks(title="EchoOrder Agent Brain v3") as demo:
    active_skill_state = gr.State("")
    gr.Markdown("# [OpenClaw] EchoOrder Agent Brain Console v3.0")
    gr.Markdown("**Enhanced Mode**: File R/W | Shell Exec | Chub/OpenClaw Skill Selector | Live SOP Injection")

    with gr.Row():
        with gr.Column(scale=3):
            chatbot = gr.Chatbot(height=500, label="Agent Chat")
            with gr.Row():
                msg_box = gr.Textbox(placeholder="Type a command...", scale=4, show_label=False)
                send_btn = gr.Button("Send", scale=1, variant="primary")
            clear_btn = gr.Button("Clear Chat", size="sm")

        with gr.Column(scale=2):
            gr.Markdown("### Skill Selector (Chub / OpenClaw / Local)")
            with gr.Row():
                skill_search = gr.Textbox(placeholder="Search skills (e.g. firebase, react)", label="Search Chub", scale=3)
                search_btn   = gr.Button("Search", scale=1)
            skill_dropdown = gr.Dropdown(
                choices=_all_choices, value="(None)",
                label="Select Skill (AI will follow its SOP once activated)",
                interactive=True
            )
            skill_preview = gr.Textbox(
                label="Skill Content Preview", lines=12, interactive=False,
                placeholder="Select a skill to preview its SOP..."
            )
            activate_btn = gr.Button("Activate Skill for Chat", variant="primary")
            active_label = gr.Markdown("**Active Skill**: None")
            gr.Markdown("---")
            gr.Markdown("### Loaded Brain Docs")
            _, files = load_brain_context()
            file_box = gr.Textbox(value="\n".join(files), label="Brain Docs", lines=8, interactive=False)
            refresh_btn = gr.Button("Refresh Brain")

    gr.Markdown("---")
    gr.Markdown("WARNING: This console has **file write and shell execution** permissions. All actions are logged.")

    # ─── Handlers ────────────────────────────────────────────────────────────
    def do_search(query):
        results = query_chub_skills(query)
        local = get_local_skills()
        choices = ["(None)"] + format_skill_choices(results, local)
        return gr.update(choices=choices, value="(None)")

    def on_skill_select(skill_label):
        if not skill_label or skill_label == "(None)":
            return ""
        return load_skill_content(skill_label)

    def activate_skill(skill_label, skill_content):
        if not skill_label or skill_label == "(None)":
            return "", "**Active Skill**: None"
        return skill_content, f"**Active Skill**: `{skill_label}`"

    def user_send(message, history, skill_content):
        if not message.strip():
            return history, ""
        history = history or []
        history.append((message, None))
        return history, ""

    def bot_respond(history, skill_content):
        if not history or history[-1][1] is not None:
            return history
        user_msg = history[-1][0]
        reply = chat_with_brain(user_msg, history[:-1], skill_content)
        history[-1] = (user_msg, reply)
        return history

    def refresh_brain():
        _, files = load_brain_context()
        return "\n".join(files)

    search_btn.click(fn=do_search, inputs=skill_search, outputs=skill_dropdown)
    skill_search.submit(fn=do_search, inputs=skill_search, outputs=skill_dropdown)
    skill_dropdown.change(fn=on_skill_select, inputs=skill_dropdown, outputs=skill_preview)
    activate_btn.click(fn=activate_skill, inputs=[skill_dropdown, skill_preview],
                       outputs=[active_skill_state, active_label])
    send_btn.click(
        fn=user_send, inputs=[msg_box, chatbot, active_skill_state], outputs=[chatbot, msg_box]
    ).then(fn=bot_respond, inputs=[chatbot, active_skill_state], outputs=chatbot)
    msg_box.submit(
        fn=user_send, inputs=[msg_box, chatbot, active_skill_state], outputs=[chatbot, msg_box]
    ).then(fn=bot_respond, inputs=[chatbot, active_skill_state], outputs=chatbot)
    clear_btn.click(lambda: [], outputs=chatbot)
    refresh_btn.click(fn=refresh_brain, outputs=file_box)

if __name__ == "__main__":
    print(f"[Brain Console v3] ROOT: {PROJECT_ROOT}")
    print(f"[Brain Console v3] Chub: {CHUB_CMD}")
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False)
