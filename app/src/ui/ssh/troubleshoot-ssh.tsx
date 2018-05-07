import * as React from 'react'

import { Repository } from '../../models/repository'
import {
  TroubleshootingState,
  TroubleshootingStep,
  InitialState,
  ValidateHostAction,
  UnknownResult,
  NoAccountAction,
} from '../../models/ssh'

import { Dispatcher } from '../../lib/dispatcher'
import { assertNever } from '../../lib/fatal-error'

import { Button } from '../lib/button'
import { ButtonGroup } from '../lib/button-group'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Loading } from '../lib/loading'
import { Octicon, OcticonSymbol } from '../octicons'
import { LinkButton } from '../lib/link-button'
import { saveLogFile } from '../../lib/ssh'

interface ITroubleshootSSHProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly troubleshootingState: TroubleshootingState | null

  /**
   * Event triggered when the dialog is dismissed by the user in the
   * ways described in the Dialog component's dismissable prop.
   */
  readonly onDismissed: () => void
}

export class TroubleshootSSH extends React.Component<
  ITroubleshootSSHProps,
  {}
> {
  public componentDidMount() {
    this.props.dispatcher.resetTroubleshooting()
  }

  private renderInitialState = (state: InitialState) => {
    return (
      <DialogContent>
        <p>
          It looks like you are having an issue connecting to an SSH remote.
        </p>
        <p>
          Do you want to troubleshoot your setup to see if Desktop can get this
          working?
        </p>
      </DialogContent>
    )
  }

  private renderValidateHost = (state: ValidateHostAction) => {
    // TODO: what verification can we do as part of a GHE setup?
    return (
      <DialogContent>
        <p>A problem was encountered connecting to the host.</p>
        <p className="output">{state.rawOutput}</p>
        <p>
          You will need to verify that this is the correct host to continue. You
          can compare the value above with the entries documented in the{' '}
          <LinkButton uri="https://help.github.com/articles/testing-your-ssh-connection/">
            GitHub help documentation
          </LinkButton>.
        </p>
      </DialogContent>
    )
  }

  private renderNoAccount = (state: NoAccountAction) => {
    return (
      <DialogContent>
        <p>It looks like a valid SSH key was not found.</p>
      </DialogContent>
    )
  }

  private renderUnknown = (state: UnknownResult): JSX.Element => {
    return (
      <DialogContent>
        <p>
          Unfortunately Desktop has exhausted all known troubleshooting tricks
          for this issue.
        </p>
        <p>
          A trace file has been generated here that will help a human
          troubleshoot the issue. Please reach out to the{' '}
          <LinkButton uri="https://github.com/desktop/desktop/issues/new">
            GitHub Desktop
          </LinkButton>{' '}
          issue tracker for further support.
        </p>
      </DialogContent>
    )
  }

  private renderStep() {
    const state = this.props.troubleshootingState
    if (state == null) {
      log.warn(`We've got a null state here. uh-oh`)
      return null
    }

    const stepText = state.kind

    switch (state.kind) {
      case TroubleshootingStep.InitialState:
        return this.renderInitialState(state)
      case TroubleshootingStep.ValidateHost:
        return this.renderValidateHost(state)
      case TroubleshootingStep.NoAccount:
        return this.renderNoAccount(state)
      case TroubleshootingStep.Unknown:
        return this.renderUnknown(state)
      default:
        return assertNever(state, `Unknown troubleshooting step: ${stepText}`)
    }
  }

  private startTroubleshooting = () => {
    this.props.dispatcher.startTroubleshooting(this.props.repository)
  }

  private verifyHost = async () => {
    const state = this.props.troubleshootingState
    if (state == null || state.kind !== TroubleshootingStep.ValidateHost) {
      log.warn('trying to validate host when in the wrong state')
      return
    }

    await this.props.dispatcher.validateHost(state.host)
    this.props.dispatcher.startTroubleshooting(this.props.repository)
  }

  private saveFile = () => {
    const state = this.props.troubleshootingState
    if (state == null || state.kind !== TroubleshootingStep.Unknown) {
      log.warn('trying to save a file when in the wrong state')
      return
    }

    saveLogFile(state.error)
  }

  private renderFooter(): JSX.Element | null {
    const state = this.props.troubleshootingState
    if (state == null) {
      log.warn(`We've got a null state here. uh-oh`)
      return null
    }

    const stepKind = state.kind

    switch (state.kind) {
      case TroubleshootingStep.InitialState:
        const disabled = state.isLoading
        return (
          <DialogFooter>
            <ButtonGroup>
              <Button onClick={this.props.onDismissed}>Cancel</Button>
              <Button
                className="submit"
                disabled={disabled}
                onClick={this.startTroubleshooting}
              >
                {state.isLoading ? <Loading /> : null}
                Start
              </Button>
            </ButtonGroup>
          </DialogFooter>
        )
      case TroubleshootingStep.ValidateHost:
        return (
          <DialogFooter>
            <ButtonGroup>
              <Button onClick={this.props.onDismissed}>Cancel</Button>
              <Button className="submit" onClick={this.verifyHost}>
                {state.isLoading ? <Loading /> : null}
                Verify
              </Button>
            </ButtonGroup>
          </DialogFooter>
        )
      case TroubleshootingStep.NoAccount:
        // TODO: what should we do here?
        return (
          <DialogFooter>
            <ButtonGroup>
              <Button onClick={this.props.onDismissed}>Cancel</Button>
              <Button className="submit" onClick={this.props.onDismissed}>
                Do it
              </Button>
            </ButtonGroup>
          </DialogFooter>
        )
      case TroubleshootingStep.Unknown:
        return (
          <DialogFooter>
            <ButtonGroup>
              <Button onClick={this.props.onDismissed}>Close</Button>
              <Button className="submit" onClick={this.saveFile}>
                <Octicon symbol={OcticonSymbol.desktopDownload} /> Save log file
              </Button>
            </ButtonGroup>
          </DialogFooter>
        )
      default:
        return assertNever(state, `Unknown troubleshooting step ${stepKind}`)
    }
  }

  public render() {
    return (
      <Dialog
        id="troubleshoot-ssh"
        title="Troubleshoot SSH"
        onDismissed={this.props.onDismissed}
      >
        {this.renderStep()}
        {this.renderFooter()}
      </Dialog>
    )
  }
}
