const { SOCKET_EVENT_EMITTED, SOCKET_EVENT_LISTEN, PRACTICE_SOCKET_EVENT_EMITTED, PRACTICE_SOCKET_EVENT_LISTEN,
    BETTING_SIDE, ROOM_NAME, B20_BET_REWARD_PERCENT, B20_LEVEL_STAKING, REWARD_FEE_NOT_20k } = require('../utils/strVar')
import SocketUtils from './socketHandle'
import GameRoom from './gameroomObj'
import GameRoomPractice from './gameroomObjPractice'
import Response from '../utils/response'
import db from '../config/connectDB'
const { getDataToken, isValidToken } = require('../utils/jwtUtils')
import { convertETHToB2O, getB2OPriceUSD } from '../utils/cryptoPriceUtils'
import { amountStakedToLevelStake } from '../utils/b2oRewardLimit'
import moment from 'moment'
import { BigNumber } from '../utils/numberUtils';

// nơi đăng ký các event được phép sử dụng của user
export function registerEventListener(socketInstance) {

    // event lấy trạng thái của game hiện tại
    socketInstance.on(SOCKET_EVENT_LISTEN.CURRENT_GAME_INFO, (data) => {

        const { roomName } = data;
        console.log(socketInstance.id, "[CURRENT_GAME_INFO]", data)

        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);


        socketInstance.emit(SOCKET_EVENT_EMITTED.CURRENT_GAME_INFO, Response.SOCKET_RESPONSE_SUCCESS(roomName, gameRoomInstance?.getCurrentGame()))
    });

    // event lấy thông tin data chart hiện tại
    socketInstance.on(SOCKET_EVENT_LISTEN.GET_CHART_DATA, (data) => {
        console.log(socketInstance.id, "[GET_CHART_DATA]", data)
        const { roomName } = data;

        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
        const chartData = gameRoomInstance?.getGameChartData();

        socketInstance.emit(SOCKET_EVENT_EMITTED.CHART_DATA, Response.SOCKET_RESPONSE_SUCCESS(roomName, chartData))
    })

    // event lấy thông tin bet của user trong game hiện tại
    socketInstance.on(SOCKET_EVENT_LISTEN.MY_BETTING_IN_GAME, (data) => {
        console.log(socketInstance.id, "[MY_BETTING_IN_GAME]", data)
        const { roomName } = data;

        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id)
        const myBettingInfo = gameRoomInstance?.getBettingData(walletAddress)

        socketInstance.emit(SOCKET_EVENT_EMITTED.MY_BETTING_IN_GAME, Response.SOCKET_RESPONSE_SUCCESS(roomName, myBettingInfo))
    })

    // betting game
    socketInstance.on(SOCKET_EVENT_LISTEN.BET, async (data) => {
        console.log(socketInstance.id, "[BET]", data)
        const { amount, bettingSide, gameId, roomName } = data;

        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);
        if (gameRoomInstance?.doBetting(walletAddress)) {
            SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "You have already betted." })
            return
        }
        console.log("walletaddress", walletAddress, "betting")
        if (!amount || amount <= 0 || typeof amount !== 'number' || !walletAddress || !bettingSide) {
            console.log("invalid data bet", walletAddress)
            SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "Amount invalid" })
            return
        }

        if (gameRoomInstance?.isTimeToBet(gameId) == true) {
            const trx = await db.transaction()
            try {
                const connection = trx('user')

                const condition = {
                    wallet_address: walletAddress,
                    is_deleted: 0
                }

                const user = await connection.clone().where(condition).first()

                const b2oBetRewardPercent = user?.b2o_staking >= B20_LEVEL_STAKING ? B20_BET_REWARD_PERCENT : 0
                const rewardRate = BigNumber(1).minus((user?.b2o_staking >= B20_LEVEL_STAKING ? 0 : REWARD_FEE_NOT_20k)).toNumber(); 

                const betting = await trx('b2o_reward_history').sum('b2o_usd_reward as reward')
                    .where('wallet_address', walletAddress).where('bet_time', '>=', moment().subtract(1, 'months').toDate()).first();

                const { stakeLevel, limitLevel } = amountStakedToLevelStake(user?.b2o_staking)
                const b2oRewardMonthly = betting?.reward ?? limitLevel

                let b20UsdBetReward = 0;
                let b20BetReward = 0

                if (BigNumber(b2oRewardMonthly).lt(BigNumber(limitLevel))) {
                    const totalB2oUsdReceived = BigNumber(convertETHToB2O(amount)).multipliedBy(BigNumber(b2oBetRewardPercent)).multipliedBy(getB2OPriceUSD())
                    const available = BigNumber(limitLevel).minus(BigNumber(b2oRewardMonthly));
                    b20UsdBetReward = BigNumber(totalB2oUsdReceived).gte(BigNumber(available)) ? BigNumber(available).toNumber() : BigNumber(totalB2oUsdReceived).toNumber();
                    b20UsdBetReward = BigNumber(b20UsdBetReward).toFixed(8)
                    b20BetReward = BigNumber(b20UsdBetReward).dividedBy(getB2OPriceUSD()).toNumber()
                }


                if (bettingSide === BETTING_SIDE.LONG || bettingSide === BETTING_SIDE.SHORT) {

                    if (amount > user.eth_balance) {
                        SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "Do not enough eth to bet." })
                        return
                    }
                    await connection.clone().increment({ "eth_balance": - amount, "b2o_balance": b20BetReward }).where(condition)
                }

                // update vào thông tin betting vào game
                const bettingResponse = gameRoomInstance.addBetting({ walletAddress, amount, bettingSide, b2oReward: b20BetReward, b2oUsdReward: b20UsdBetReward, rewardRate });

                if (!bettingResponse) {
                    SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, {})
                    await trx.rollback()
                    return;
                }

                const dataB2oRewardInserted = {
                    game_uuid: gameId,
                    wallet_address: walletAddress,
                    bet_amount: amount,
                    b2o_reward: b20BetReward,
                    b2o_usd_reward: b20UsdBetReward,
                    bet_time: new Date()
                }

                await trx('b2o_reward_history').insert(dataB2oRewardInserted)
                console.log("bet done");
                await trx.commit();
                SocketUtils.emitToAllInRoom(roomName, SOCKET_EVENT_EMITTED.HAVE_NEW_BETTED, { roomName });
                SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.NEED_UPDATE_BALANCE, {});
                SocketUtils.emitToAll(SOCKET_EVENT_EMITTED.NOTICE_GAME_HOT, GameRoom.getAllHotGame());
            } catch (error) {
                console.log('error in BET', error)
                await trx.rollback()
                SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { message: error.stack })
            } finally {
                await trx.commit()
            }
        } else {
            console.log("not time to bet")
            SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "Now is not time to bet" })
        }
    })

    socketInstance.on(SOCKET_EVENT_LISTEN.HEDGE, (data) => {
        try {
            const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);
            console.log(socketInstance.id, "[HEDGE]", data, "-", walletAddress)
            const { roomName } = data;

            const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
            if (gameRoomInstance?.hedge(walletAddress) == true) {
                SocketUtils.emitToAllInRoom(roomName, SOCKET_EVENT_EMITTED.HAVE_NEW_BETTED, { roomName });
                SocketUtils.emitToAll(SOCKET_EVENT_EMITTED.NOTICE_GAME_HOT, GameRoom.getAllHotGame());
            } else {
                SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "Can not hedge" })
            }
        } catch (e) {
            console.log(e);
        }
    })

    // lấy thông tin 2 ô long và short
    socketInstance.on(SOCKET_EVENT_LISTEN.GET_BETTING_INFO, (data) => {
        // console.log(socketInstance.id, "[GET_BETTING_INFO]", data)
        const { roomName } = data;

        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);


        socketInstance.emit(SOCKET_EVENT_EMITTED.NEW_BETTING_INFO, Response.SOCKET_RESPONSE_SUCCESS(roomName, gameRoomInstance?.getBetInformationOfWallet(walletAddress)))
    })

    socketInstance.on(SOCKET_EVENT_LISTEN.TOTAL_BET_STATS, (data) => {
        // console.log(socketInstance.id, "-[TOTAL_BET_STATS]", data)
        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);
        socketInstance.emit(SOCKET_EVENT_EMITTED.TOTAL_BET_STATS, GameRoom.getTotalBetStatsOfAddress(walletAddress));
    })

    socketInstance.on("JOIN_ROOM", (data) => {
        console.log(socketInstance.id, "-[JOIN_ROOM]", data)
        const { roomName } = data;
        socketInstance.join(roomName);
        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
        if (gameRoomInstance) {
            socketInstance.emit(SOCKET_EVENT_EMITTED.CHART_DATA, Response.SOCKET_RESPONSE_SUCCESS(roomName, gameRoomInstance?.getGameChartData()));
        }
    });

    socketInstance.on("LEAVE_ROOM", (data) => {
        console.log(socketInstance.id, "-[LEAVE_ROOM]", data)
        const { roomName } = data;
        socketInstance.leave(roomName);
    });


    //gửi dữ liệu chart cho lần đầu vào
    //tạm set vào mặc định
    socketInstance.join(ROOM_NAME.BTCUSDT1M)
    const defaultGameInstance = GameRoom.getGameRoomByName(ROOM_NAME.BTCUSDT1M);
    setTimeout(() => {
        socketInstance.emit(SOCKET_EVENT_EMITTED.CHART_DATA, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.BTCUSDT1M, defaultGameInstance?.getGameChartData()));
        socketInstance.emit(SOCKET_EVENT_EMITTED.CURRENT_GAME_INFO, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.BTCUSDT1M, defaultGameInstance?.getCurrentGame()))
        socketInstance.emit(SOCKET_EVENT_EMITTED.TOTAL_BET_STATS, GameRoom.getTotalBetStatsOfAddress(socketInstance.walletAddress));
    }, 500);



}





export function registerEventListenerForGuest(socketInstance) {

    // event lấy trạng thái của game hiện tại
    socketInstance.on(SOCKET_EVENT_LISTEN.CURRENT_GAME_INFO, (data) => {
        console.log(socketInstance.id, "-[GUESTROOM][CURRENT_GAME_INFO]", data)
        const { roomName } = data;

        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);


        socketInstance.emit(SOCKET_EVENT_EMITTED.CURRENT_GAME_INFO, Response.SOCKET_RESPONSE_SUCCESS(roomName, gameRoomInstance?.getCurrentGame()))
    });

    // event lấy thông tin data chart hiện tại
    socketInstance.on(SOCKET_EVENT_LISTEN.GET_CHART_DATA, (data) => {
        console.log(socketInstance.id, "-[GUESTROOM][GET_CHART_DATA]", data)
        const { roomName } = data;

        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
        const chartData = gameRoomInstance?.getGameChartData();

        socketInstance.emit(SOCKET_EVENT_EMITTED.CHART_DATA, Response.SOCKET_RESPONSE_SUCCESS(roomName, chartData))
    })

    socketInstance.on("JOIN_ROOM", (data) => {
        const { roomName } = data;
        socketInstance.join(roomName);
        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
        if (gameRoomInstance) {
            socketInstance.emit(SOCKET_EVENT_EMITTED.CHART_DATA, Response.SOCKET_RESPONSE_SUCCESS(roomName, gameRoomInstance?.getGameChartData()));
        }

    });

    socketInstance.on("LEAVE_ROOM", (data) => {
        const { roomName } = data;
        socketInstance.leave(roomName);
    });


    //sử dụng lấy thông tin betting cơ bản cho guest
    socketInstance.on(SOCKET_EVENT_LISTEN.GET_BETTING_INFO, (data) => {
        // console.log(socketInstance.id, "[GET_BETTING_INFO] for guest", data)
        const { roomName } = data;
        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);

        socketInstance.emit(SOCKET_EVENT_EMITTED.NEW_BETTING_INFO, Response.SOCKET_RESPONSE_SUCCESS(roomName, gameRoomInstance?.getBetInformationOfGuest()))
    })

    // socketInstance.on("LOGIN", (data) => {
    //     console.log(socketInstance.id,"-[GUESTROOM][LOGIN]",data)
    //     const { accessToken } = data;
    //     if (isValidToken(accessToken)) {
    //         const { walletAddress } = getDataToken(accessToken);
    //         SocketUtils.addConnectionToList(socketInstance, walletAddress);
    //         registerEventListener(socketInstance);
    //     }
    // });




    //gửi dữ liệu chart cho lần đầu vào
    //tạm set vào mặc định
    setTimeout(() => {
        socketInstance.join(ROOM_NAME.BTCUSDT1M)
        const defaultGameInstance = GameRoom.getGameRoomByName(ROOM_NAME.BTCUSDT1M);
        socketInstance.emit(SOCKET_EVENT_EMITTED.CHART_DATA, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.BTCUSDT1M, defaultGameInstance?.getGameChartData()));
        socketInstance.emit(SOCKET_EVENT_EMITTED.CURRENT_GAME_INFO, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.BTCUSDT1M, defaultGameInstance?.getCurrentGame()));
        socketInstance.emit(SOCKET_EVENT_EMITTED.TOTAL_BET_STATS, GameRoom.getTotalBetStatsOfAddress(socketInstance.walletAddress));
    }, 500);


}


export function addtionalEventForBot(socketInstance) {

    socketInstance.on(SOCKET_EVENT_LISTEN.BOT_BET, async (data) => {
        console.log(socketInstance.id, "[BOT_BET]", data)
        const { amount, bettingSide, gameId, roomName, time } = data;

        const gameRoomInstance = GameRoom.getGameRoomByName(roomName);
        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);
        // if (gameRoomInstance?.doBetting(walletAddress)) {
        //     SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "You have already betted." })
        //     return
        // }
        console.log("bot walletaddress", walletAddress, "betting")
        if (!amount || amount <= 0 || typeof amount !== 'number' || !walletAddress || !bettingSide) {
            console.log("invalid data bet", walletAddress)
            SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "Amount invalid" })
            return
        }

        if (gameRoomInstance?.isTimeToBet(gameId) == true) {
            const trx = await db.transaction()
            try {
                const connection = trx('user')

                const condition = {
                    wallet_address: walletAddress,
                    is_deleted: 0
                }

                const user = await connection.clone().where(condition).first();



                if (bettingSide === BETTING_SIDE.LONG || bettingSide === BETTING_SIDE.SHORT) {

                    if (amount > user.eth_balance) {
                        SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "Do not enough eth to bet." })
                        return
                    }
                    await connection.clone().increment({ "eth_balance": - amount }).where(condition)
                }

                // update vào thông tin betting vào game
                const bettingResponse = gameRoomInstance.addBettingBot({ walletAddress, amount, bettingSide, b2oReward: 0, b2oUsdReward: 0, rewardRate: 0.95 });

                if (!bettingResponse) {
                    console.log("bot bet failed");
                    SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, {})
                    await trx.rollback()
                    return;
                }
                console.log(`[${time}]bot bet done amount: ${amount}`);
                await trx.commit();
                SocketUtils.emitToAllInRoom(roomName, SOCKET_EVENT_EMITTED.HAVE_NEW_BETTED, { roomName });
                SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.NEED_UPDATE_BALANCE, {});
                SocketUtils.emitToAll(SOCKET_EVENT_EMITTED.NOTICE_GAME_HOT, GameRoom.getAllHotGame());
            } catch (error) {
                console.log('error in  BOT BET', error)
                await trx.rollback()
                SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { message: error.stack })
            } finally {
                await trx.commit()
            }
        } else {
            console.log("not time to bet")
            SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "Now is not time to bet" })
        }
    })

    
    socketInstance.on(PRACTICE_SOCKET_EVENT_LISTEN.PRACTICE_BOT_BET, async (data) => {
        console.log(socketInstance.id, "[PRACTICE_BOT_BET]", data)
        const { amount, bettingSide, gameId, roomName, time } = data;

        const gameRoomInstance = GameRoomPractice.getGameRoomByName(roomName);
        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);
        // if (gameRoomInstance?.doBetting(walletAddress)) {
        //     SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "You have already betted." })
        //     return
        // }
        console.log("bot walletaddress", walletAddress, "betting")
        if (!amount || amount <= 0 || typeof amount !== 'number' || !walletAddress || !bettingSide || !BETTING_SIDE[bettingSide]) {
            console.log("invalid data bet", walletAddress)
            SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "betting parameter invalid" })
            return
        }

        if (gameRoomInstance?.isTimeToBet(gameId) == true) {
            try {

                // update vào thông tin betting vào game
                const bettingResponse = gameRoomInstance.addBettingBot({ walletAddress, amount, bettingSide, b2oReward: 0, b2oUsdReward: 0, rewardRate: 1 });

                if (!bettingResponse) {
                    console.log("bot bet failed");
                    SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, {})
                    return;
                }
                console.log(`[${time}]bot bet practice done amount: ${amount}`);
                SocketUtils.emitToAllInRoom(roomName, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_HAVE_NEW_BETTED, { roomName });
                SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_NEED_UPDATE_BALANCE, {});
            } catch (error) {
                console.log('error in  BOT BET PRACTICE', error)
                SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { message: error.stack })
            }
        } else {
            console.log("not time to bet")
            SocketUtils.emitEventToWallet(walletAddress, SOCKET_EVENT_EMITTED.EXECUTE_FAIL, { result: false, message: "Now is not time to bet" })
        }
    })

    socketInstance.join(ROOM_NAME.PRACTICE1M)


}


export function registerEventListenerPractice(socketInstance) {
    const gameRoomInstance = GameRoomPractice.getGameRoomByName(ROOM_NAME.PRACTICE1M);

    // practice game: event lấy trạng thái của game hiện tại
    socketInstance.on(PRACTICE_SOCKET_EVENT_LISTEN.PRACTICE_CURRENT_GAME_INFO, () => {
        console.log(socketInstance.id, "[PRACTICE_CURRENT_GAME_INFO]")

        const currentGameInfo = gameRoomInstance?.getCurrentGame()

        socketInstance.emit(PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_CURRENT_GAME_INFO, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.PRACTICE1M, currentGameInfo))
    });

    // practice game: event lấy thông tin data chart hiện tại
    socketInstance.on(PRACTICE_SOCKET_EVENT_LISTEN.PRACTICE_GET_CHART_DATA, () => {
        console.log(socketInstance.id, "[PRACTICE_GET_CHART_DATA]")

        const chartData = gameRoomInstance?.getGameChartData();

        socketInstance.emit(PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_CHART_DATA, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.PRACTICE1M, chartData))
    })

    // practice game: event lấy thông tin bet của user trong game hiện tại
    socketInstance.on(PRACTICE_SOCKET_EVENT_LISTEN.PRACTICE_MY_BETTING_IN_GAME, () => {
        console.log(socketInstance.id, "[PRACTICE_MY_BETTING_IN_GAME]")

        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id)
        const myBettingInfo = gameRoomInstance?.getBettingData(walletAddress)

        socketInstance.emit(PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_MY_BETTING_IN_GAME, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.PRACTICE1M, myBettingInfo))
    })

    // practice game: betting game with bot
    socketInstance.on(PRACTICE_SOCKET_EVENT_LISTEN.PRACTICE_BET, async (data) => {
        console.log(socketInstance.id, "[PRACTICE_BET]", data)
        const { amount, bettingSide, gameId } = data;

        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);
        if (gameRoomInstance?.doBetting(walletAddress)) {
            SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_EXECUTE_FAIL, { result: false, message: "PRACTICE_BET - You have already betted." })
            return
        }
        console.log("PRACTICE_BET wallet address", walletAddress, "betting")
        if (!amount || amount <= 0 || typeof amount !== 'number' || !walletAddress || !bettingSide) {
            console.log("PRACTICE_BET invalid data bet", walletAddress)
            SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_EXECUTE_FAIL, { result: false, message: "PRACTICE_BET - Amount invalid" })
            return
        }

        if (gameRoomInstance?.isTimeToBet(gameId) == true) {
            const trx = await db.transaction()
            try {
                const connection = trx('user')

                const condition = {
                    wallet_address: walletAddress,
                    is_deleted: 0
                }

                const user = await connection.clone().where(condition).first()

                if (bettingSide === BETTING_SIDE.LONG || bettingSide === BETTING_SIDE.SHORT) {

                    if (BigNumber(amount).gt(BigNumber(user?.practice_balance))) {
                        SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_EXECUTE_FAIL, { result: false, message: "PRACTICE_BET - Do not enough eth to bet." })
                        return
                    }
                    await connection.clone().increment({ "practice_balance": - amount }).where(condition)
                }

                // practice game: update vào thông tin betting vào game
                const bettingResponse = gameRoomInstance.addBetting({ walletAddress, amount, bettingSide, b2oReward: 0, b2oUsdReward: 0, rewardRate: 1 });

                if (!bettingResponse) {
                    SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_EXECUTE_FAIL, {})
                    await trx.rollback()
                    return;
                }

                console.log("PRACTICE_BET - bet done");
                await trx.commit();

                SocketUtils.emitToAllInRoom(ROOM_NAME.PRACTICE1M, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_HAVE_NEW_BETTED, { roomName: ROOM_NAME.PRACTICE1M });
                SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_NEED_UPDATE_BALANCE, {});
            } catch (error) {
                console.log('PRACTICE_BET ERR :', error)
                await trx.rollback()
                SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_EXECUTE_FAIL, { message: error.stack })
            } finally {
                await trx.commit()
            }
        } else {
            console.log("PRACTICE_BET ERR : not time to bet")
            SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_EXECUTE_FAIL, { result: false, message: "PRACTICE_BET - Now is not time to bet" })
        }
    })

    // practice game: close betted
    socketInstance.on(PRACTICE_SOCKET_EVENT_LISTEN.PRACTICE_HEDGE, () => {
        try {
            const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);
            console.log(socketInstance.id, "[PRACTICE-HEDGE]", walletAddress)

            if (gameRoomInstance?.hedge(walletAddress) == true) {
                SocketUtils.emitToAllInRoom(ROOM_NAME.PRACTICE1M, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_HAVE_NEW_BETTED, { roomName: ROOM_NAME.PRACTICE1M });
            } else {
                SocketUtils.emitEventToWallet(walletAddress, PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_EXECUTE_FAIL, { result: false, message: "PRACTICE_BET - Can not hedge" })
            }
        } catch (e) {
            console.log(e);
        }
    })

    // practice game: lấy thông tin 2 ô long và short
    socketInstance.on(PRACTICE_SOCKET_EVENT_LISTEN.PRACTICE_GET_BETTING_INFO, () => {

        const walletAddress = SocketUtils.getWalletAddressOfSocket(socketInstance.id);
        const bettingInfo = gameRoomInstance?.getBetInformationOfWallet(walletAddress)

        socketInstance.emit(PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_NEW_BETTING_INFO, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.PRACTICE1M, bettingInfo))
    })


    //practice game: gửi dữ liệu chart và thông tin game hiện tại cho lần đầu vào practice
    socketInstance.join(ROOM_NAME.PRACTICE1M)
    setTimeout(() => {
        socketInstance.emit(PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_CHART_DATA, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.PRACTICE1M, gameRoomInstance?.getGameChartData()));
        socketInstance.emit(PRACTICE_SOCKET_EVENT_EMITTED.PRACTICE_CURRENT_GAME_INFO, Response.SOCKET_RESPONSE_SUCCESS(ROOM_NAME.PRACTICE1M, gameRoomInstance?.getCurrentGame()))
    }, 500);

}