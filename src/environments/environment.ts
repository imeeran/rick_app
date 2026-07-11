// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  version: '1.0.3',
  buildNumber: '7',
  apiUrl: 'http://localhost:3000/api', // Direct URL (bypasses proxy)
  backendUrl: 'http://localhost:3000',

  // apiUrl: 'https://api.ricklimo.com/api',
  // backendUrl: 'https://api.ricklimo.com',
  
  // oneSignalAppId: '5800a0b8-0487-430e-a224-1553d4d6b5ef'
  oneSignalAppId: '43ed9db3-041f-4e34-a9fb-af840c7aa15e'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
