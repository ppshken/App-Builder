export default {
  skipTrailingSlashRedirect:true,
  distDir:process.env.NOCODE_BUILD_DIR||'.next',
  serverExternalPackages:['better-sqlite3','playwright','playwright-core'],
  // Preserve the existing 512 MB backup limit plus multipart headers. Individual
  // endpoints still enforce their smaller upload/JSON limits before saving.
  experimental:{proxyClientMaxBodySize:'513mb'},
};
