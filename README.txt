AYSO FIELD WORKSHEET - OFFLINE APP
==================================

What each person using it does
------------------------------
 1. Open the app's link in Chrome on the tablet (Wi-Fi on).
 2. Tap INSTALL APP. The icon is added to the home screen.
 3. Open it from the icon and tap SIGN IN WITH GOOGLE. The app creates a
    "Referee Assessments" folder in that person's Google Drive.
 From then on it works with no signal. "Save to PDF" sends the PDF to Drive,
 or keeps it on the tablet until there is a connection again.

Before anyone can do that, the person looking after the app does a one-time
setup (about 20 minutes, on a PC): parts 1 to 3 below.


Files in this folder
--------------------
  index.html             the worksheet
  config.js              the one file you edit (your Google Client ID)
  drive.js               saves PDFs to Google Drive
  sw.js                  keeps the app on the device for offline use and sends
                         waiting PDFs when the connection comes back
  manifest.webmanifest   lets devices install it as an app
  icons/                 app icons


PART 1. PUT THE APP ONLINE (free, GitHub Pages)
-----------------------------------------------
 a. Create a free account at github.com.
 b. Click "+" (top right) > New repository. Name it ayso-worksheet, choose
    Public, click Create repository.
 c. Click "uploading an existing file". Unzip this folder and drag everything
    inside it (including the icons folder) onto the page. Commit changes.
 d. Repository Settings > Pages. Source: "Deploy from a branch", Branch "main",
    folder "/ (root)". Save.
 e. After a minute or two the app is at
        https://YOUR-USERNAME.github.io/ayso-worksheet/
    This is the link you give to referees and assessors.

 Only the app is public. Worksheets and PDFs stay on each tablet and in each
 person's own Google Drive.


PART 2. CREATE THE "SIGN IN WITH GOOGLE" ID (free, Google Cloud)
---------------------------------------------------------------
 a. Go to console.cloud.google.com and sign in. Create a project
    (project picker at the top > New project), name it "AYSO Worksheet".
 b. Search "Google Drive API" in the top search bar, open it, click Enable.
 c. Menu > Google Auth Platform (also listed as "OAuth consent screen") >
    Get started.
      App name: AYSO Field Worksheet. User support email: your email.
      Audience: External. Contact email: your email. Agree and Create.
 d. Data Access > Add or remove scopes. Find ".../auth/drive.file"
    ("See, edit, create and delete only the specific Google Drive files you
    use with this app"), tick it, Update, Save.
 e. Audience > Publish app > Confirm, so it says "In production".
    (While it says "Testing", only people you add as test users can sign in.)
    The app only asks for the drive.file permission, which Google treats as
    a low-risk permission, so no Google review is normally needed.
 f. Clients > Create client. Application type: Web application.
    Name: AYSO Worksheet. Under "Authorized JavaScript origins" click Add URI
    and enter   https://YOUR-USERNAME.github.io   (no folder, no slash at
    the end). Create. Copy the Client ID (ends in .apps.googleusercontent.com).


PART 3. PUT THE CLIENT ID IN THE APP
------------------------------------
 a. In your GitHub repository, click config.js, then the pencil (Edit).
 b. Paste the Client ID between the quote marks:
        googleClientId: '1234-abcd.apps.googleusercontent.com',
 c. Commit changes. Wait a minute, then open the app link to try it.


HOW SAVING WORKS
----------------
 - Save to PDF with a connection: the PDF goes straight to the
   "Referee Assessments" folder in Google Drive.
 - Save to PDF with no signal: the PDF is kept on the tablet and a yellow note
   shows how many are waiting. When the tablet is back online they are sent
   automatically, even with the app closed, as long as it is within about an
   hour of the last Google sign-in. After that they are sent the next time the
   app is opened online: tap "Upload now" on the yellow note. Saving another
   PDF online also sends anything waiting.
 - Google sign-in on the web lasts about an hour. When it has run out, the app
   renews it when you tap Save to PDF or Upload now. Usually a sign-in window
   flashes up and closes by itself.
 - The same PDF is never stored twice in Drive.
 - The app can only see the folder and files it creates. It cannot open
   anything else in anyone's Google Drive.
 - Settings (gear icon) shows who is signed in, and has Sign in / Disconnect.


UPDATING THE APP LATER
----------------------
 Upload the changed files to the same GitHub repository (Add file > Upload
 files). Devices download the new version the next time the app is opened
 online, and use it from the time after that.
