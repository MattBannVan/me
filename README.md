# Digital Clone Web Application

## Overview
This repository contains the source code for a web-based digital clone application. The system features a 3D avatar that replicates the user's physical appearance, voice, and personality. It includes an admin GUI for continuous knowledge ingestion and agentic capabilities for executing tasks like email communication and image generation.

## Core Features
* **3D Interactive Avatar:** Real-time lip-sync and expressive animations synced to audio.
* **Voice Cloning:** Custom Text-to-Speech (TTS) engine trained on the user's voice.
* **Personality & Knowledge (RAG):** LLM configured with custom system prompts and a Retrieval-Augmented Generation pipeline to reflect the user's personality and specific knowledge.
* **Admin GUI:** Interface for the user to upload documents, text snippets, and preferences to the clone's vector database.
* **Agentic Tools:** Integrated workflows for sending emails, generating images, and executing web-based tasks.

---

## Master Design Document

### 1. System Architecture
The application follows a decoupled client-server architecture.

* **Frontend (User Interface & 3D Rendering):** React.js + React Three Fiber
* **Backend (API & AI Orchestration):** Python (FastAPI)
* **Database (Knowledge Base):** PostgreSQL (App data) + Pinecone/Milvus (Vector DB for RAG)
* **AI/LLM Framework:** LangChain or LlamaIndex

### 2. Component Breakdown

#### A. Frontend (Web UI & Avatar)
* **3D Engine:** React Three Fiber / Three.js for rendering the custom 3D model (.gltf/.glb).
* **Animation System:** Rhubarb Lip Sync or Viseme generation for real-time mouth movement synced to incoming audio streams.
* **Chat Interface:** Text and voice input UI for user interaction.
* **Admin Dashboard:** A secured portal where the user can input text, upload PDFs/Markdown, and manage the clone's API keys and tool permissions.

#### B. Backend (Orchestration & Logic)
* **API Gateway:** FastAPI handles WebSocket connections for low-latency voice/text streaming.
* **Agent Engine:** Processes user intent. Determines whether to chat conversationally or invoke an external tool (e.g., "send an email").
* **RAG Pipeline:** When a user asks a question, the backend queries the Vector DB for context inputted via the Admin GUI, injecting it into the LLM prompt.

#### C. AI & Integration Layer
* **Large Language Model (LLM):** The core "brain" (e.g., Gemini 1.5 Pro) wrapped in a strict system prompt defining Matthew's personality traits and conversational style.
* **Text-to-Speech (TTS):** Custom voice model (e.g., ElevenLabs API) generating streaming audio buffers.
* **Speech-to-Text (STT):** Whisper API for transcribing end-user microphone input.

#### D. Agentic Tool Integrations
* **Email Module:** SMTP or SendGrid API integration. The LLM generates the email body and extracts the recipient address, requiring user confirmation before sending.
* **Image Generation Module:** DALL-E 3 or Stable Diffusion API. The LLM drafts the optimal prompt based on the user's request and returns the image URL to the frontend.

### 3. Data Flow Example (User Interaction)
1. End-user speaks into the web interface.
2. Frontend sends audio to Backend via WebSocket.
3. STT converts audio to text.
4. Backend retrieves relevant context from Vector DB.
5. LLM generates a response or triggers a tool (e.g., Image Gen).
6. TTS converts the LLM text response to an audio stream.
7. Frontend receives audio and triggers 3D avatar lip-sync animations.

### 4. Setup & Installation
*(To be populated as the development environment is initialized)*

```
