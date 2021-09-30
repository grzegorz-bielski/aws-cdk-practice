import * as cdk from "@aws-cdk/core"
import * as codepipeline from "@aws-cdk/aws-codepipeline"
import * as codepipeline_actions from "@aws-cdk/aws-codepipeline-actions"
import * as cdk_pipeline from "@aws-cdk/pipelines"

import { CdkWorkshopStack } from "./cdk-workshop-stack"

export class WorkshopPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // const xd = new codepipeline.Pipeline()

    // Defines the artifact representing the sourcecode
    const sourceArtifact = new codepipeline.Artifact()
    // Defines the artifact representing the cloud assembly
    // (cloudformation template + all other assets)
    const cloudAssemblyArtifact = new codepipeline.Artifact()

    // The basic pipeline declaration. This sets the initial structure
    // of our pipeline
    const pipeline = new cdk_pipeline.CdkPipeline(this, "Pipeline", {
      pipelineName: "WorkshopPipeline",
      cloudAssemblyArtifact,

      // Generates the source artifact from the repo we created in the last step
      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: "GitHub",
        output: sourceArtifact,
        oauthToken: cdk.SecretValue.secretsManager("cdk-demo-gh-token"),
        owner: "grzegorz-bielski",
        repo: "",
        trigger: codepipeline_actions.GitHubTrigger.POLL,
      }),

      // Builds our source code outlined above into a could assembly artifact
      synthAction: cdk_pipeline.SimpleSynthAction.standardNpmSynth({
        sourceArtifact, // Where to get source code to build
        cloudAssemblyArtifact, // Where to place built source

        buildCommand: "npm run build", // Language-specific build cmd
      }),
    })

    const deploy = new WorkshopPipelineStage(this, "Deploy")
    const deployStage = pipeline.addApplicationStage(deploy)

    deployStage.addActions(
      new cdk_pipeline.ShellScriptAction({
        actionName: "TestViewerEndpoint",
        useOutputs: {
          ENDPOINT_URL: pipeline.stackOutput(deploy.hcViewerUrl),
        },
        commands: ["curl -Ssf $ENDPOINT_URL"],
      })
    )
    deployStage.addActions(
      new cdk_pipeline.ShellScriptAction({
        actionName: "TestAPIGatewayEndpoint",
        useOutputs: {
          ENDPOINT_URL: pipeline.stackOutput(deploy.hcEndpoint),
        },
        commands: [
          "curl -Ssf $ENDPOINT_URL/",
          "curl -Ssf $ENDPOINT_URL/hello",
          "curl -Ssf $ENDPOINT_URL/test",
        ],
      })
    )
  }
}

class WorkshopPipelineStage extends cdk.Stage {
  public readonly hcViewerUrl: cdk.CfnOutput
  public readonly hcEndpoint: cdk.CfnOutput

  constructor(scope: cdk.Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props)

    const service = new CdkWorkshopStack(this, "WebService")

    this.hcEndpoint = service.hcEndpoint
    this.hcViewerUrl = service.hcViewerUrl
  }
}

// https://cdkworkshop.com/20-typescript/70-advanced-topics/200-pipelines/3000-new-pipeline.html
// https://phatrabbitapps.com/cdk-pipelines-continuous-delivery-for-aws-cdk-applications
// https://bobbyhadz.com/blog/aws-amplify-react-auth
