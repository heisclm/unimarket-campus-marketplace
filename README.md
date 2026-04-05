# Unimarket Campus Marketplace

## Project Overview
Unimarket Campus Marketplace is an innovative platform designed to serve the needs of university students and local businesses. It enhances the way students interact with local businesses, providing a seamless marketplace experience.

## Features
- **User-friendly Interface:** Enjoy an intuitive UI/UX designed for ease of use.
- **Search Functionality:** Quickly find products and services with powerful search tools.
- **Secure Transactions:** Ensure safe and reliable payment methods for transactions.
- **Business Listings:** Allow local businesses to showcase their offerings.
- **Review System:** Enable students to leave feedback and ratings for businesses.

## Tech Stack
- **Frontend:** React, TypeScript
- **Backend:** Node.js, Express
- **Database:** MongoDB
- **Hosting:** AWS

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/heisclm/unimarket-campus-marketplace.git
   cd unimarket-campus-marketplace
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file in the root directory and add the following variables:
   ```
   DATABASE_URL=mongodb://your_database_url
   PORT=your_port
   ```
4. Run the application:
   ```bash
   npm start
   ```

## Architecture
The application follows a microservices architecture, separating the frontend and backend into distinct services. This approach allows for scalability and maintainability. The frontend interacts with the backend through RESTful APIs, ensuring a smooth data flow between the client and server.

## Contribution Guidelines
1. **Fork the repository** and clone it locally.
2. **Create a new branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/YourFeature
   ```
3. Make your changes, then stage and commit them:
   ```bash
   git add .
   git commit -m "Add your message here"
   ```
4. **Push to your fork** and submit a pull request.

Thank you for contributing!

---