index-scbgdz1v.js:75 
 POST https://auth.privy.io/api/v1/oauth/init 401 (Unauthorized)
index-scbgdz1v.js:75 Uncaught (in promise) n$c: Redirect URL is not allowed
    at l$d (index-scbgdz1v.js:75:61791)
    at gs$1.post (index-scbgdz1v.js:350:125836)
    at async oa.getAuthorizationUrl (index-scbgdz1v.js:108:122552)
    at async initLoginWithOAuth (index-scbgdz1v.js:350:89477)
Caused by: FetchError: [POST] "https://auth.privy.io/api/v1/oauth/init": 401 
    at async gs$1.tl [as baseFetch] (index-scbgdz1v.js:75:60219)
    at async gs$1.post (index-scbgdz1v.js:350:125754)
    at async oa.getAuthorizationUrl (index-scbgdz1v.js:108:122552)
    at async initLoginWithOAuth (index-scbgdz1v.js:350:89477)
﻿

