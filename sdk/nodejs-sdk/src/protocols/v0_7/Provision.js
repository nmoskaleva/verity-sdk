'use strict'
const utils = require('../../utils')
const Protocol = require('../Protocol')
const indy = require('indy-sdk')

/**
 * An interface for controlling a 0.7 Provision protocol.
 */
module.exports = class Provision extends Protocol {
/**
 * Provision 0.7 protocol interface class
 */
  constructor (threadId = null, token = null) {
    /**
     * The name for the message family.
     */
    const msgFamily = 'agent-provisioning'
    /**
     * The version for the message family.
     */
    const msgFamilyVersion = '0.7'
    /**
     * The qualifier for the message family. Uses Evernym's qualifier.
     */
    const msgQualifier = utils.constants.EVERNYM_MSG_QUALIFIER
    super(msgFamily, msgFamilyVersion, msgQualifier, threadId)

    /**
     Name for 'create-edge-agent' control message
     */
    this.msgNames.CREATE_EDGE_AGENT = 'create-edge-agent'

    this.token = JSON.parse(token)
  }

  async validateToken (token) {
    const concatStr = (
      token.nonce +
      token.timestamp +
      token.sponseeId +
      token.sponsorId
    )
    const data = Buffer.from(concatStr, 'utf-8')
    const sig = Buffer.from(token.sig, 'base64')

    const valid = await indy.cryptoVerify(token.sponsorVerKey, data, sig)

    if (valid === false) {
      throw new Error('Invalid provision token -- signature does not validate')
    }
  }

  /**
  * Provision 0.7 protocol interface class
  */
  async sendToVerity (context, packedMsg) {
    const rawResponse = await utils.sendPackedMessage(context, packedMsg)
    const jweBytes = Buffer.from(rawResponse, 'utf8')
    return utils.unpackMessage(context, jweBytes)
  }

  /**
     * Creates the control message without packaging and sending it.
     * @param context an instance of the Context object initialized to a verity-application agent
     * @return the constructed message (JSON object)
     *
     * @see #provision
     */
  provisionMsg (context) {
    const msg = this._getBaseMessage(this.msgNames.CREATE_EDGE_AGENT)
    msg.requesterVk = context.sdkVerKey
    if (this.token != null) {
      msg.provisionToken = this.token
    }
    return msg
  }

  /**
     * Creates and packages message without sending it.
     * @param context an instance of the Context object initialized to a verity-application agent
     * @return the byte array ready for transport
     *
     * @see #provision
     */
  async provisionMsgPacked (context) {
    const msg = this.provisionMsg(context)
    return utils.packMessage(
      context.walletHandle,
      msg,
      context.verityPublicDID,
      context.verityPublicVerKey,
      context.sdkVerKey,
      context.verityPublicVerKey
    )
  }

  /**
     * Sends the connection create message to Verity
     * @param context an instance of the Context object initialized to a verity-application agent
     * @return new Context with provisioned details
     */
  async provision (context) {
    if (this.token != null) {
      await this.validateToken(this.token)
    }

    const packedMsg = await this.provisionMsgPacked(context)
    const response = await this.sendToVerity(context, packedMsg)
    context.domainDID = response.selfDID
    context.verityAgentVerKey = response.agentVerKey
    return context
  }
}
