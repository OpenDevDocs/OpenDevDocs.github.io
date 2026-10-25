let SiteName = "Open Dev Docs"

function getSiteName(){
    return SiteName
}

// Public GitHub repository of the site. Readers report mistakes and ask questions here.
export const GITHUB_ORG_URL = "https://github.com/OpenDevDocs";
export const GITHUB_REPO_URL = "https://github.com/OpenDevDocs/OpenDevDocs.github.io";
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`;

// Public contact address shown on /contact and in the legal pages.
// Leave empty to hide it; GitHub issues are always listed as a contact channel.
export const CONTACT_EMAIL = "";

// Google AdSense publisher ID, e.g. "ca-pub-1234567890123456".
// While it is empty no ad code, verification tag or ads.txt record is emitted.
export const ADSENSE_CLIENT_ID = "";

// Ad unit IDs (the `data-ad-slot` number) for manual placements. Leave a slot
// empty to skip that placement; Auto ads still work with just the client ID.
export const ADSENSE_SLOTS = {
    // Below the lesson body, above Previous/Next
    lessonBottom: "",
    // Below a blog post
    blogBottom: "",
};

export {getSiteName};
