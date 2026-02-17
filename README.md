# UCP Chat Client

An AI-powered commerce client that connects to any Universal Commerce Protocol (UCP) compliant merchant. Browse products and manage checkout while inspecting the UCP API request/responses.

## Features
- **AI Assistant**: Powered by Gemini 2.0 Flash with native UCP tool calling.
- **Dynamic Onboarding**: Connect to any UCP merchant by providing their profile URL.
- **UCP Inspector**: Real-time visibility into headers, request bodies, and responses.
  
https://github.com/user-attachments/assets/0ffa3667-0350-48db-bb81-f8a70acf186f

## Prerequisites
- Node.js 18+ 
- Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

## Merchant Requirements

To work with this client, a merchant server must:
1.  **Support UCP v2026-01-23**: Adhere to the Universal Commerce Protocol standards.
2.  **Product Catalog**: Support `GET /catalog` (returning an array of products or an object with an `items` array).
3.  **Checkout Lifecycle**: Implement the standard UCP `/checkout-sessions` endpoints (`POST`, `GET`, `PUT`, and `POST .../complete`).
4.  **Discovery**: Provide merchant metadata at `GET /.well-known/ucp`.

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/akshaybroota/UCP-client.git
   cd UCP-client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env.local` file:
   ```bash
   NEXT_PUBLIC_GEMINI_API_KEY=your_actual_key_here
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser. Keep your merchant server URL handy and test away!
