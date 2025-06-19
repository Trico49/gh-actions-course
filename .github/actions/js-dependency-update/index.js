const core = require("@actions/core");
const exec = require("@actions/exec");
const github = require("@actions/github");

const setupGit = async () => {
  await exec.exec("git config --global user.name 'gh-automation'");
  await exec.exec("git config --global user.email 'gh-automation@email.com'");
};

const validateBranchName = ({ branchName }) =>
  /^[a-zA-Z0-9_\-./]+$/.test(branchName);
const validateDirectoryName = ({ dirName }) =>
  /^[a-zA-Z0-9_\-/]+$/.test(dirName);

async function run() {
  const baseBranch = core.getInput("base-branch" , { required: true });
  const targetBranch = core.getInput("target-branch" , { required: true });
  const ghToken = core.getInput("gh-token" , { required: true });
  const workingDir = core.getInput("working-directory" , { required: true });
  const debug = core.getBooleanInput("debug");

  const commonExecOpts = {
    cwd: workingDir
  }

  core.setSecret(ghToken);

  if (!validateBranchName({ branchName: baseBranch })) {
    core.setFailed(
      "Invalid base-branch name. Branch names should include only characters, numbers, hyphens, dots, underscores and forward slashes."
    );
    return;
  }

  if (!validateBranchName({ branchName: targetBranch })) {
    core.setFailed(
      "Invalid target-branch name. Branch names should include only characters, numbers, hyphens, dots, underscores and forward slashes."
    );
    return;
  }

  if (!validateDirectoryName({ dirName: workingDir })) {
    core.setFailed(
      "Invalid working directory name. Directory names should include only characters, numbers, hyphens, underscores and forward slashes."
    );
    return;
  }

  core.info(`[js-dependency-update] base-branch is ${baseBranch}`);
  core.info(`[js-dependency-update] target-branch is ${targetBranch}`);
  core.info(`[js-dependency-update] working directory is ${workingDir}`);

  await exec.exec("npm update", [], {
    ...commonExecOpts,
  });

  const gitstatus = await exec.getExecOutput(
    "git status -s package*.json",
    [],
     ...commonExecOpts,
  );

  if (gitstatus.stdout.length > 0) {
    core.info("[js-dependency-update] : There are updates available");
    // Add PR creation logic here using octokit
    await setupGit();
    await exec.exec( git checkout -b ${targetBranch} , [], {
      ...commonExecOpts,
    });
    await exec.exec('git add package.json package-lock.json', [], {
      ...commonExecOpts,
    });
    await exec.exec('git commit -m "chore: Update dependencies"', [], {
      ...commonExecOpts,
    });
    await exec.exec(`git push -u origin ${targetBranch} --force`, [], {
      ...commonExecOpts,
    });

    const octokit = github.getOctokit(ghToken);

    try {
      await octokit.rest.pulls.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        title: 'Update NPM dependencies',
        body: 'This pull request updates NPM packages'
        base: baseBranch,
        head: targetBranch
      });

    } catch (e) {
      core.error('[js-dependency-update] : Something went wrong while creating the PR. Check logs below');
      core.error(e.message);
      core.error(e);
      core.setFailed(e);
    }
    
}

run(); 
