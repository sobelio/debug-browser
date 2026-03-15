{
  description = "debug-browser: React debugging CLI with headless browser introspection";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    crane.url = "github:ipetkov/crane";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, crane, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        craneLib = crane.mkLib pkgs;

        # --- Derivation 1: Node.js daemon ---
        daemon = pkgs.buildNpmPackage {
          pname = "debug-browser-daemon";
          version = "0.1.0";
          src = ./daemon;

          npmDeps = pkgs.importNpmLock {
            npmRoot = ./daemon;
          };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;

          # DO NOT set dontNpmBuild -- we need npm run build (tsc + copy scripts)
          # TypeScript is in devDependencies and buildNpmPackage installs them during build

          installPhase = ''
            runHook preInstall
            mkdir -p $out/lib/daemon
            cp -r dist $out/lib/daemon/dist
            cp -r node_modules $out/lib/daemon/node_modules
            cp package.json $out/lib/daemon/package.json
            runHook postInstall
          '';
        };

        # --- Derivation 2: Rust CLI ---
        commonArgs = {
          src = craneLib.cleanCargoSource ./.;
          strictDeps = true;
          buildInputs = pkgs.lib.optionals pkgs.stdenv.isDarwin [
            pkgs.libiconv
          ];
        };

        cargoArtifacts = craneLib.buildDepsOnly commonArgs;

        cli = craneLib.buildPackage (commonArgs // {
          inherit cargoArtifacts;
        });

        # --- Derivation 3: Composed wrapper ---
        wrapperArgs = [
          "--prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.nodejs ]}"
          "--set DEBUG_BROWSER_DAEMON_PATH ${daemon}/lib/daemon/dist/daemon.js"
        ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
          "--set PLAYWRIGHT_BROWSERS_PATH ${pkgs.playwright-driver.browsers}"
          "--set PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS true"
        ];

      in {
        packages.default = pkgs.symlinkJoin {
          name = "debug-browser-${cli.version or "0.1.0"}";
          paths = [ cli ];
          nativeBuildInputs = [ pkgs.makeWrapper ];
          postBuild = ''
            wrapProgram $out/bin/debug-browser \
              ${builtins.concatStringsSep " \\\n              " wrapperArgs}
          '';
        };

        devShells.default = craneLib.devShell {
          packages = with pkgs; [ nodejs ];
        };
      });
}
