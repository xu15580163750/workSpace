function Relay(options, validate, model) {
    this.addrmin = 1 // 地址最小
    this.addrmax = 100 // 地址最大
    this.validate = validate
    this.model = model
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
        commond += this.validate.crc16(addrS + '0307D00001') + ','
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
            if (validatedata.toLowerCase() !== result.toLowerCase()) {
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

    var commond = this.validate.crc16(options.oldAddr + '1007D000010200' + options.shortAddress)
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
            if (func !== '10') {
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
    var cmd = [];
    if (code.indexOf('11') > -1 || code.indexOf('12') > -1 || code.indexOf('13') > -1 || code.indexOf('14') > -1) {//开关机，模式，温度，风速
        var commond = this.validate.crc16(addr + '030BB80004');
        cmd.push(commond)
    }
    if (code.indexOf("21") > -1) {//开关机判断电流阈值
        var commond21 = this.validate.crc16(addr + '0307e40001');
        cmd.push(commond21)
    }
    console.log(cmd.toString())
    var validate = this.validate
    return {
        cmd: cmd.join(','),
        timeout: 5000,
        resolve: function (result, success, error) {
            var data = result.split(',')
            if (data.length !== cmd.length) {
                return error(400)
            }
            var res = {}
            var allChecks = {}
            for (let i = 0; i < data.length; i++) {
                if (data[i].toLowerCase() !== validate.crc16(data[i].substr(0, data[i].length - 4))) {
                    return error(401)
                }
                if (data[i].substr(0, 2) !== addr) {
                    return error(402)
                }
                if (data[i].substr(2, 2) !== '03') {
                    return error(403)
                }
                if (cmd[i] == commond) {//01 03 0BB8 0004 ---- 01 03 08 0001 0001 0001 0001
                    //开关机，模式，温度，风速
                    let kgj = data[i].substr(6, 4)
                    let ms = data[i].substr(10, 4)
                    let wd = data[i].substr(14, 4)
                    let fs = data[i].substr(18, 4)
                    allChecks['11'] = kgj
                    allChecks['12'] = ms
                    allChecks['13'] = wd
                    allChecks['14'] = fs
                }
                if (cmd[i] == commond21) {
                    //开关机判断电流阈值
                    let dl_kg = data[i].substr(6, 4);
                    allChecks['21'] = dl_kg
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
    if (typeof state === 'number') state = state.toString()
    while (addr.length < 2) {
        addr = '0' + addr;
    }
    var cmd = [];
    while (state.length < 4) {
        state = '0' + state
    }
    //01 10 0BB8 0001 02 0001 -- 01 10 0BB8 0001
    if (code.indexOf('11') > -1) {//开关机
        var commond1 = this.validate.crc16(addr + '100BB8000102' + state)
        cmd.push(commond1)
    }
    if (code.indexOf('12') > -1) {//模式
        var commond2 = this.validate.crc16(addr + '100BB80002040001' + state)
        cmd.push(commond2)
    }
    if (code.indexOf('13') > -1) {//温度
        var operates = this.model.operates.filter(item => {
            return item.shortAddress === '12'
        })
        var operateValue = parseInt(operates[0].value).toString(16);
        while (operateValue.length < 4) {
            operateValue = '0' + operateValue
        }
        state = (parseInt(state) * 10).toString(16)
        while (state.length < 4) {
            state = '0' + state
        }
        var commond3 = this.validate.crc16(addr + '100BB80003060001' + operateValue + state)
        cmd.push(commond3)
    }
    if (code.indexOf('14') > -1) {//风速
        let operates1 = this.model.operates.filter(item => {
            return item.shortAddress === '12'
        })
        let operateValue1 = parseInt(operates1[0].value).toString(16);
        while (operateValue1.length < 4) {
            operateValue1 = '0' + operateValue1
        }

        let operates2 = this.model.operates.filter(item => {
            return item.shortAddress === '13'
        })
        let operateValue2 = (parseInt(operates2[0].value) * 10).toString(16);
        while (operateValue2.length < 4) {
            operateValue2 = '0' + operateValue2
        }
        var commond4 = this.validate.crc16(addr + '100BB80004080001' + operateValue1 + operateValue2 + state)
        cmd.push(commond4)
    }
    var validate = this.validate;
    return {
        cmd: cmd.join(','),
        timeout: 5000,
        resolve: function (result, success, error) {
            var item = result.substr(0, result.length - 4);
            if (validate.crc16(item).toLowerCase() !== result.toLowerCase()) {
                return error(400)
            }
            if (item.substr(0, 2) !== addr) {
                return error(402)
            }
            if (item.substr(2, 2) !== '10') {
                return error(403)
            }
            /*state=state==='0001'?1:0;*/
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