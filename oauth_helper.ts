export default class oauth_helpers {
  static refresh_token() {
    let properties = PropertiesService.getUserProperties();
  
    let clientId = properties.getProperty("inoreaderClientId");
    let clientSecret = properties.getProperty("inoreaderClientSecret");
    let refreshToken = properties.getProperty("inoreaderRefreshToken");
  
    // Make a POST request with form data.
    var formData = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };
    // Because payload is a JavaScript object, it is interpreted as
    // as form data. (No need to specify contentType; it automatically
    // defaults to either 'application/x-www-form-urlencoded'
    // or 'multipart/form-data')
    var options = {
      method: "post",
      payload: formData,
    };
    let response = UrlFetchApp.fetch("https://www.inoreader.com/oauth2/token", options);
  
    let responseMap = JSON.parse(response.getContentText());
  
    let newAccesstoken = responseMap["access_token"]
    let newExpiresIn = responseMap["expires_in"]
    let newRefreshToken = responseMap["refresh_token"]
  
    let now = Date.now();
    let expiresAt = new Date(now + newExpiresIn * 1000)
  
    properties.setProperty("inoreaderAccessToken",newAccesstoken);
    properties.setProperty("inoreaderRefreshToken",newRefreshToken);
    properties.setProperty("inoreaderExpiresAt", expiresAt.toISOString());
  }
  
} 