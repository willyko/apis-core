const get = require('lodash/get')

const syncMethodsForBlockNumber = async ({
  ethereum,
  models,
  blockNumber,
  web3,
}) => {
  const transactions = await models.EthereumTx.findAll({
    where: {
      blockNumber,
    },
  })
  console.log('[sync-methods] num transactions', transactions && transactions.length || 0)
  if (transactions && transactions.length) {
    try {
      const methods = transactions
        .filter(({ input }) => input && ethereum.decoder.decodeMethod(input))
        .map(tx => {
          const decoded = ethereum.decoder.decodeMethod(tx.input)
          return {
            contract: tx.to,
            method: decoded.name,
            params: JSON.stringify(decoded.params),
            txHash: tx.hash,
          }
        })

      if (methods && methods.length) {
        const bulkMethods = await models.EthereumMethod.bulkCreate(methods)
        console.log('[sync-methods] bulkMethods', bulkMethods)
      }
    } catch (e) {
      console.error('[ethereum-listener][syncMethods] EthereumMethod.bulkCreate', e)
    }
  }
}

const syncMethods = async ({
  models,
  ethereum,
  web3,
}) => {
  try {
    const latestMethod = await models.EthereumMethod.findOne({
      limit: 1,
      order: [[ 'createdAt', 'DESC' ]],
      include: [
        {
          model: models.EthereumTx,
          include: [models.EthereumBlock],
        },
      ],
    })
    const start = get(latestMethod, 'EthereumTx.EthereumBlock.number', process.env.ETHEREUM_MIN_BLOCK_NUMBER || 0)
    console.log('[ethereum-listener][syncMethods] start block is ', start)
    const end = await web3.eth.getBlockNumber()
    console.log('[ethereum-listener][syncMethods] end block is ', end)
    let current = start

    while (current <= end) {
      // console.error(`[ethereum-listener][syncMethods] syncing block ${current}`)
      await syncMethodsForBlockNumber({
        models,
        web3,
        ethereum,
        blockNumber: current,
      })
      current += 1;
    }

  } catch (e) {
    console.error(e)
  }

}


module.exports.syncMethodsForBlockNumber = syncMethodsForBlockNumber
module.exports.syncMethods = syncMethods
