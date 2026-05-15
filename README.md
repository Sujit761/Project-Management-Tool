# ProjectFlow - Professional Edition ⚡

**ProjectFlow** is a premium, real-time collaborative project management application built for high-performance teams. It provides a visual workspace for managing tasks, tracking progress, and communicating in real-time, similar to industry leaders like Trello and Asana.

## 🚀 Key Features

- **Real-Time Collaboration**: Powered by WebSockets, every action (moving tasks, adding comments, creating columns) is synced instantly across all users.
- **Dynamic Kanban Board**: 
  - Drag-and-drop tasks between columns with optimistic UI updates.
  - Create, rename, and delete custom status columns.
- **Comprehensive Task Management**:
  - Assign priorities (Low, Medium, High, Urgent).
  - Set due dates with visual overdue indicators.
  - Organize with multi-tag support.
  - Assign tasks to specific team members.
- **Team Communication**: Threaded commenting system within each task card.
- **Notification System**: Instant alerts for task assignments and team comments.
- **Project Progress Tracker**: A smart visual indicator that calculates completion percentage based on tasks in the "Done" column.
- **Premium Dark UI**: A modern, responsive design built with a custom CSS design system and smooth animations.

## 🛠️ Technology Stack

- **Frontend**: 
  - [React 18](https://reactjs.org/)
  - [Vite](https://vitejs.dev/) (Build tool)
  - Vanilla CSS (Custom Design System)
- **Backend**: 
  - [FastAPI](https://fastapi.tiangolo.com/) (Asynchronous Python Framework)
  - [SQLAlchemy](https://www.sqlalchemy.org/) (Database ORM)
  - [AioSQLite](https://github.com/omnilib/aiosqlite) (Async SQLite driver)
- **Real-Time**: WebSockets for live bi-directional communication.
- **Authentication**: JWT (JSON Web Tokens) with secure password hashing (BCrypt).

## 🏁 Getting Started

### Prerequisites
- Python 3.8+
- Node.js (v16+) and npm

### 1. Backend Setup
Navigate to the root directory and install dependencies:
```bash
pip install -r requirements.txt
