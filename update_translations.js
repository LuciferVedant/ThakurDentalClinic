const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, 'frontend/public/locales');
const languages = fs.readdirSync(localesPath).filter(f => fs.statSync(path.join(localesPath, f)).isDirectory());

const dashboardEn = {
  "dashboard": {
    "logout": "Logout",
    "admin": "(Admin)",
    "adminDashboard": "Admin Dashboard",
    "manageStaff": "Manage staff accounts and clinic operations",
    "totalDoctors": "Total Doctors",
    "receptionists": "Receptionists",
    "totalPatients": "Total Patients",
    "staffMembers": "Staff Members",
    "name": "Name",
    "email": "Email",
    "role": "Role",
    "status": "Status",
    "active": "Active",
    "inactive": "Inactive",
    "addStaff": "+ Add Staff",
    "createStaffAccount": "Create Staff Account",
    "userType": "User Type",
    "doctor": "Doctor",
    "receptionist": "Receptionist",
    "grantAdmin": "Grant Admin Privileges",
    "firstName": "First Name",
    "lastName": "Last Name",
    "password": "Password",
    "generate": "Generate",
    "cancel": "Cancel",
    "createAccount": "Create Account",
    "accountCreated": "Account Created!",
    "shareCredentials": "Share these credentials securely with the staff member",
    "saveCredentials": "Make sure to save these credentials. They won't be shown again.",
    "done": "Done",
    "blogManagement": "Blog Management",
    "createNewPost": "Create New Post",
    "loading": "Loading...",
    "edit": "Edit",
    "delete": "Delete",
    "noBlogPosts": "No blog posts found. Create one to get started!",
    "welcomeBack": "Welcome back, {{name}}!",
    "manageAppointments": "Manage your appointments and dental health records",
    "upcomingAppointments": "Upcoming Appointments",
    "totalVisits": "Total Visits",
    "nextCheckup": "Next Checkup",
    "notScheduled": "Not Scheduled",
    "bookAppointment": "Book an Appointment",
    "scheduleCheckup": "Schedule your next dental checkup",
    "scheduleAppointment": "Schedule Appointment",
    "recentActivity": "Recent Activity",
    "noRecentActivity": "No recent activity"
  }
};

const dashboardHi = {
  "dashboard": {
    "logout": "लॉग आउट",
    "admin": "(एडमिन)",
    "adminDashboard": "एडमिन डैशबोर्ड",
    "manageStaff": "स्टाफ खाते और क्लिनिक संचालन प्रबंधित करें",
    "totalDoctors": "कुल डॉक्टर",
    "receptionists": "रिसेप्शनिस्ट",
    "totalPatients": "कुल मरीज",
    "staffMembers": "स्टाफ सदस्य",
    "name": "नाम",
    "email": "ईमेल",
    "role": "भूमिका",
    "status": "स्थिति",
    "active": "सक्रिय",
    "inactive": "निष्क्रिय",
    "addStaff": "+ स्टाफ जोड़ें",
    "createStaffAccount": "स्टाफ खाता बनाएं",
    "userType": "उपयोगकर्ता प्रकार",
    "doctor": "डॉक्टर",
    "receptionist": "रिसेप्शनिस्ट",
    "grantAdmin": "एडमिन विशेषाधिकार प्रदान करें",
    "firstName": "पहला नाम",
    "lastName": "अंतिम नाम",
    "password": "पासवर्ड",
    "generate": "उत्पन्न करें",
    "cancel": "रद्द करें",
    "createAccount": "खाता बनाएं",
    "accountCreated": "खाता बन गया!",
    "shareCredentials": "स्टाफ सदस्य के साथ इन क्रेडेंशियल्स को सुरक्षित रूप से साझा करें",
    "saveCredentials": "इन क्रेडेंशियल्स को सहेजना सुनिश्चित करें। इन्हें दोबारा नहीं दिखाया जाएगा।",
    "done": "पूर्ण",
    "blogManagement": "ब्लॉग प्रबंधन",
    "createNewPost": "नई पोस्ट बनाएं",
    "loading": "लोड हो रहा है...",
    "edit": "संपादित करें",
    "delete": "हटाएं",
    "noBlogPosts": "कोई ब्लॉग पोस्ट नहीं मिली। आरंभ करने के लिए एक बनाएं!",
    "welcomeBack": "वापसी पर स्वागत है, {{name}}!",
    "manageAppointments": "अपने अपॉइंटमेंट और दंत स्वास्थ्य रिकॉर्ड प्रबंधित करें",
    "upcomingAppointments": "आगामी अपॉइंटमेंट",
    "totalVisits": "कुल विजिट",
    "nextCheckup": "अगला चेकअप",
    "notScheduled": "निर्धारित नहीं है",
    "bookAppointment": "अपॉइंटमेंट बुक करें",
    "scheduleCheckup": "अपना अगला दंत चेकअप निर्धारित करें",
    "scheduleAppointment": "अपॉइंटमेंट निर्धारित करें",
    "recentActivity": "हाल की गतिविधि",
    "noRecentActivity": "कोई हाल की गतिविधि नहीं"
  }
};

languages.forEach(lang => {
  const filePath = path.join(localesPath, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // If language is Hindi, use Hindi translations, else fallback to English for now so at least it renders something.
    data.dashboard = lang === 'hi' ? dashboardHi.dashboard : dashboardEn.dashboard;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
});

console.log("Translations updated!");
