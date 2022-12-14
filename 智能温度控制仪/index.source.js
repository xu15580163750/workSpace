function Relay(options, validate) {
    this.addrmin = 1 // 地址最小
    this.addrmax = 100 // 地址最大
    this.validate = validate
    this.button = [0, 1, 2, 3]
    this.options = options // options.defaulttest  options.defaultbutton
    var _this = this
    _this.checksAddress = []
    options.defaultCheck.forEach(function (test) {
        _this['analysis' + test.address] = test.analysis// test.analysis 解析函数
        _this.checksAddress.push(test.address)
    })
}

//搜索地址
Relay.prototype.find = function (startAddr, endAddr) {
    if (startAddr && typeof startAddr === 'string') startAddr = parseInt(startAddr)
    if (endAddr && typeof endAddr === 'string') endAddr = parseInt(endAddr)
    var addr = startAddr || this.addrmin
    var end = endAddr || this.addrmax
    var commond = ''
    while (addr <= end) {
        var addrS = addr.toString(16)
        while (addrS.length < 2) {
            addrS = '0' + addrS
        }
        commond += this.validate.crc16(addrS + '0310010001') + ','
        addr++
    }
    console.log(startAddr)
    console.log(endAddr)
    console.log(commond)
    var validate = this.validate
    var devicename = this.options.name
    var defaultCheck = this.options.defaultCheck
    var attribute = []
    if (this.options.attribute !== undefined) {
        attribute = this.options.attribute
    }
    return {
        cmd: commond.substr(0, commond.length - 1),
        timeout: 5000,
        resolve: function (result, success, error) {
            var data = result.substr(0, result.length - 4)
            var validatedata = validate.crc16(data)
            if (validatedata !== result) {
                return error(401)
            }
            var func = result.substr(2, 2)
            if (func !== '03') {
                return error(402)
            }
            var address = result.substr(0, 2)
            var json = {
                shortAddress: address,
                name: devicename + address,
                checks: defaultCheck,
                attribute: attribute
            }
            return success(json)
        },
        changeAddr: true // 改变地址
    }
}
/**
 * 改变设备地址
 * 回调 【addr】  返回
 */
Relay.prototype.changeAddr = function (options) {
    if (typeof options.shortAddress === 'number') options.shortAddress = options.shortAddress.toString(16)
    while (options.shortAddress.length < 2) {
        options.shortAddress = '0' + options.shortAddress
    }
    if (typeof options.oldAddr === 'number') options.oldAddr = options.oldAddr.toString(16)
    while (options.oldAddr.length < 2) {
        options.oldAddr = '0' + options.oldAddr
    }

    var commond = this.validate.crc16(options.oldAddr + '06000a00' + options.shortAddress)
    var validate = this.validate
    var devicename = this.options.name
    var defaultCheck = this.options.defaultCheck
    var attribute = []
    if (this.options.attribute !== undefined) {
        attribute = this.options.attribute
    }
    return {
        cmd: commond,
        timeout: 5000,
        resolve: function (result, success, error) {
            var item = result.substr(0, result.length - 4);
            if (validate.crc16(item).toLowerCase() !== result.toLowerCase()) {
                return error(401)
            }
            var func = item.substr(2, 2);
            if (func !== '06') {
                return error(402)
            }
            var json = {
                shortAddress: options.shortAddress,
                name: devicename + options.shortAddress,
                checks: defaultCheck,
                attribute: attribute
            }
            return success(json)
        }
    }
}
/**
 * 读取数据
 */
Relay.prototype.read = function (addr, code, attribute) {
    if (code == null) code = this.checksAddress
    else if (typeof code === 'string') code = [code]
    var analysis = []
    var _this = this
    code.forEach(function (item) {
        analysis.push(_this['analysis' + item])
    })
    while (addr.length < 2) {
        addr = '0' + addr
    }
    var cmd = []
    if (code.indexOf('1') > -1) {//温度测量值
        var commond1 = this.validate.crc16(addr + '0310010001')
        cmd.push(commond1)
    }
    if (code.indexOf('2') > -1) {//报警状态
        var commond2 = this.validate.crc16(addr + '0312000001')
        cmd.push(commond2)
    }
    if (code.indexOf('3') > -1) {//温度设定值
        var commond3 = this.validate.crc16(addr + '0300000001')
        cmd.push(commond3)
    }
    var validate = this.validate
    return {
        cmd: cmd.join(','),
        resolve: function (result, success, error) {
            var data = result.split(',')
            if (data.length !== cmd.length) {
                return error(400)
            }
            var res = {}
            var allChecks = {}
            for (let i = 0; i < data.length; i++) {
                var item = data[i].substr(0, data[i].length - 4);
                if (validate.crc16(item).toLowerCase() !== data[i]) {
                    return error(401)
                }
                if (item.substr(0, 2) !== addr) {
                    return error(402)
                }
                if (item.substr(2, 2) !== '03') {
                    return error(403)
                }
                if (cmd[i] == commond1) {//温度测量值
                    allChecks['1'] = item.substr(6, 4)
                }
                if (cmd[i] == commond2) {//报警状态
                    allChecks['2'] = item.substr(6, 4)
                }
                if (cmd[i] == commond3) {//温度设定值
                    allChecks['3'] = item.substr(6, 4)
                }
            }
            code.forEach(function (item, index) {
                var analyze = null
                eval(analysis[index])
                if (allChecks[item] && analyze) {
                    res[item] = analyze(allChecks[item])
                }
            })
            success(res)
        }
    }
}
// 写入
//addr为设备地址编号,code为控制节点,state为行为,字符串
Relay.prototype.write = function (addr, code, state) {
    if (typeof addr === 'number') addr = addr.toString(16)
    while (addr.length < 2) {
        addr = '0' + addr;
    }
    state = parseInt(state).toString(16)
    while (state.length < 4) {
        state = '0' + state
    }
    var cmd = [];
    if (code.indexOf('11') > -1) {
        var commond11=this.validate.crc16()
    }
    var validate = this.validate;
    return {
        cmd: cmd.join(','),
        timeout: 5000,
        resolve: function (result, success, error) {
            var item = result.substr(0, result.length - 4);
            if (result.toLowerCase() !== validate.crc16(item).toLowerCase()) {
                return error(401)
            }
            if (item.substr(0, 2) !== addr) {
                return error(402)
            }
            if (item.substr(2, 2) !== '06') {
                return error(403)
            }
            success(state)
        }
    }
}
/**
 * 生成主动上报
 * addr 设备地址
 * parameters 默认参数配置
 * changecycle 默认参数 --变化周期 1个字节
 * rangeofchange 默认参数 --变化幅度 1个字节
 * lowerLimitValue 默认参数 --下限值 字节数(根据commonds中的reslength/2)
 * upperlimitvalue  默认参数 --上限值 字节数(根据commonds中的reslength/2)
 * port 串口配置
 */
Relay.prototype.encode = function (addr, parameters, port) {

}
/**
 * 简析主动上报指令，并且生成一个数组
 */
Relay.prototype.decode = function (result) {

}
Relay.prototype.navi = function (result) {
    if (result) {
        const ret = result.substr(0, 2)
        return ret
    }
    return null
}

module.exports = Relay