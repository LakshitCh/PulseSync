# PulseSync: Kinetic Playlist Architect


**Live Demo:** [https://pulse-sync-gilt.vercel.app/](https://pulse-sync-gilt.vercel.app/)

PulseSync is an intelligent, biometric-driven music recommendation engine. By bridging the gap between physical exertion and audio attributes, PulseSync ensures your workout playlist is perfectly paced for your specific gym routine.

Seed your favorite tracks, select your workout split (e.g., Treadmill, Heavy Lifting), and let our multi-dimensional vector math engine generate the perfect high-energy playlist using Spotify's global catalog.

## 🚀 Features

*   **Smart Audio Matching:** Our custom algorithm calculates Euclidean distance across normalized 4D audio feature vectors (BPM, Energy, Valence, Danceability) to find tracks that mathematically match your "vibe".
*   **Hybrid Architecture:** Seamlessly merges real-time live track indexing from the Spotify Web API with a lightning-fast, client-side matrix processing engine for zero-latency sorting.
*   **Biometric Filtering:** Adjusts audio weighting dynamically based on your selected physical activity. Running on the treadmill? The engine prioritizes exact BPM cadence matching. Hitting the weights? It shifts priority to pure energy and intensity.
*   **Organic Minimalist UI:** A beautiful, distraction-free interface built with Tailwind CSS, featuring glassmorphism, dynamic gradients, and smooth micro-animations.

## 🛠 Tech Stack

*   **Framework:** Next.js 15 (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **External Data:** Spotify Web API (Client Credentials Flow)
*   **Deployment:** Vercel

## 💻 Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/LakshitCh/PulseSync.git
    cd PulseSync
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root directory and add your Spotify Developer API keys:
    ```env
    SPOTIFY_CLIENT_ID=your_client_id_here
    SPOTIFY_CLIENT_SECRET=your_client_secret_here
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🧠 How the Engine Works

Traditional playlists rely on simple genre tags or collaborative filtering. PulseSync treats music as math:
1.  **Vectorization:** Every song is represented as a coordinate in 4D space `[BPM, Energy, Valence, Danceability]`.
2.  **Centroid Calculation:** When you seed multiple tracks, the engine calculates the mathematical center (the "Vibe Centroid") of those tracks.
3.  **Distance Matching:** The algorithm scans the dataset and calculates the Euclidean distance between each track and your Vibe Centroid, automatically surfacing the closest mathematical matches.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
