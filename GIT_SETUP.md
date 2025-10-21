# Git Setup Instructions

## ✅ Local Repository Created

Your code has been committed to a local Git repository!

**Commit Details:**
- Commit ID: `7e99abd`
- Branch: `master`
- Files: 22 files, 10,624 lines of code
- Message: "Initial commit: AgriGuru - AI-powered agricultural market price assistant"

## 📤 Connect to Remote Repository (GitHub/GitLab)

### Option 1: GitHub

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Repository name: `agriguru-market-price`
   - Description: "AI-powered agricultural market price assistant for Indian farmers"
   - Keep it Public or Private
   - **DO NOT** initialize with README (we already have one)
   - Click "Create repository"

2. **Connect your local repository:**
   ```powershell
   cd c:/AgriGuru/market-price-app
   git remote add origin https://github.com/YOUR_USERNAME/agriguru-market-price.git
   git branch -M main
   git push -u origin main
   ```

### Option 2: GitLab

1. **Create a new project on GitLab:**
   - Go to https://gitlab.com/projects/new
   - Project name: `agriguru-market-price`
   - Visibility: Public or Private
   - **Uncheck** "Initialize repository with a README"
   - Click "Create project"

2. **Connect your local repository:**
   ```powershell
   cd c:/AgriGuru/market-price-app
   git remote add origin https://gitlab.com/YOUR_USERNAME/agriguru-market-price.git
   git branch -M main
   git push -u origin main
   ```

### Option 3: Azure DevOps / Other Git Services

Similar process - create a repository and use the provided remote URL.

## 🔐 Authentication

When you push for the first time, you'll need to authenticate:

### GitHub (Recommended: Personal Access Token)
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo` (full control)
4. Copy the token
5. Use it as password when pushing

### Alternative: SSH Key
```powershell
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key
Get-Content ~/.ssh/id_ed25519.pub | clip

# Add to GitHub: Settings → SSH and GPG keys → New SSH key
```

Then use SSH URL:
```powershell
git remote add origin git@github.com:YOUR_USERNAME/agriguru-market-price.git
```

## 📝 Future Commits

After making changes:

```powershell
# Check what changed
git status

# Add all changes
git add .

# Commit with message
git commit -m "Your commit message here"

# Push to remote
git push
```

## 🌿 Branching Strategy

For feature development:

```powershell
# Create and switch to new branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Add new feature"

# Push branch to remote
git push -u origin feature/your-feature-name

# Merge to main (after testing)
git checkout main
git merge feature/your-feature-name
git push
```

## 📊 Useful Git Commands

```powershell
# View commit history
git log --oneline --graph --all

# View changes
git diff

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard local changes
git checkout -- <file>

# Pull latest changes
git pull

# View remote repositories
git remote -v

# Create .gitignore for sensitive files
# Already created - includes node_modules, .env
```

## 🔒 Important: Protect Sensitive Data

Your `.env` file with API keys is already in `.gitignore` and won't be committed.

**Never commit:**
- API keys
- Passwords
- Personal tokens
- `.env` files

## 📦 Repository Structure

```
agriguru-market-price/
├── src/
│   ├── App.jsx                    # Main application
│   ├── components/
│   │   └── ChatMessage.jsx        # Message component
│   └── services/
│       ├── geminiService.js       # AI intelligence
│       ├── marketPriceAPI.js      # Data fetching
│       └── voiceService.js        # Voice I/O
├── public/                        # Static assets
├── ARCHITECTURE.md                # System design
├── INTELLIGENT_FALLBACK.md        # Nearby search
├── DISTRICT_REORGANIZATION.md     # Admin changes
├── PROXIMITY_SEARCH.md            # Proximity algo
├── TROUBLESHOOTING.md             # Debug guide
├── README.md                      # Project overview
├── package.json                   # Dependencies
└── vite.config.js                 # Build config
```

## 🚀 Next Steps

1. Create remote repository (GitHub/GitLab)
2. Connect local to remote
3. Push your code
4. Share repository URL with team
5. Set up CI/CD (optional)
6. Enable GitHub Pages for demo (optional)

## 📧 Collaboration

To collaborate with others:

```powershell
# Clone repository (for new team members)
git clone https://github.com/YOUR_USERNAME/agriguru-market-price.git

# Pull latest changes
git pull

# Create feature branch
git checkout -b feature/new-feature

# Push and create pull request
git push -u origin feature/new-feature
```

## 🎉 You're All Set!

Your AgriGuru project is now version controlled with Git. Create a remote repository and push to share your amazing work!
