const { exportAbi } = require("./utils");

exportAbi()
  .then((p) => console.log(`ABI exportado para ${p}`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
