
const PENDING = 0
const FULFILLED = 1
const REJECTED = 2

const Tasks = []

const noop = ()=>{}

const microTask = (fn)=>{
    if(typeof queueMicrotask === 'function'){
        queueMicrotask(fn)
    }else if(typeof process === 'object' && process.nextTick){
        process.nextTick(fn)
    }else if(typeof MutationObserver === 'function'){
        const observer = new MutationObserver(fn)
        const textNode = document.createTextNode('1')
        observer.observe(textNode, { characterData: true })
        textNode.data = '2'
    }else{
        setTimeout(fn)
    }
}

const startQueue = ()=>{
    let len = Tasks.length - 1
    while(len > 0){
        const task = Tasks.shift()
        setTimeout(()=>{
            task()
        }, 0)
        len--
    }
}

const toString = Object.prototype.toString

const isFunction = (val)=>{
    return toString.call(val) === '[object Function]'
}

const isObject = (val)=>{
    // return toString.call(val) === '[object Object]'
    return val != null && (typeof val == 'object' || typeof val == 'function')
}

const isPromise = (val)=>{
    return typeof val?.then === 'function'
}

const RejectPromise = (promise, reason)=>{
    let reactions = promise.rejectReactions
    promise.statu = REJECTED
    promise.value = reason
    promise.reason = reason
    promise.fulfillReactions = []
    promise.rejectReactions = []
    if(promise.isHandled === false){

    }
    TriggerPromiseReactions(reactions, reason)
}

const TriggerPromiseReactions = function(reactions, argument){
    for(let element of reactions){
        // console.log(element)
        let result = NewPromiseReactionJob(element, argument)
        microTask(()=>{
            result.job()
        })
    }
}

const FulfillPromise = (promise, value)=>{
    let reactions = promise.fulfillReactions
    promise.statu = FULFILLED
    promise.value = value
    promise.fulfillReactions = []
    promise.rejectReactions = []
    TriggerPromiseReactions(reactions, value)
}

const resolve = function(val){
    let F = this
    let promise = F.promise
    let alreadyResolved = F.alreadyResolved
    if(alreadyResolved) return undefined
    F.alreadyResolved =  true
    if(promise === val){
        // reject promise with a TypeError as the reason
        RejectPromise(promise, new TypeError('Chaining cycle detected for promise #<Promise'))
        return undefined
    }
    if(!isObject(val)){
        FulfillPromise(promise, val)
        return undefined
    }
    let then
    try{
        then = val.then
    }catch(e){
        RejectPromise(promise, e)
        return undefined
    }
    if(!isFunction(then)){
        FulfillPromise(promise, val)
        return undefined
    }
    // let thenJobCallBack = HostMakeJobCallback(then)
    let job = NewPromiseResolveThenableJob(promise, val, then)
    microTask(job.job)
    return undefined
}

const reject = function(reason){
    let F = this;
    let promise = F.promise
    let alreadyResolved = F.alreadyResolved
    if(alreadyResolved) return undefined
    F.alreadyResolved = true
    RejectPromise(promise, reason)
    return undefined
}

const HostMakeJobCallback = (callBack)=>{
    return { callBack: callBack, HostDefined: "" }
}

const createResolvingFunctions = function(promise){
    let alreadyResolved = false
    const obj = { promise: promise, alreadyResolved: alreadyResolved }
    const _fn = resolve.bind(obj)
    _fn.promise = promise
    _fn.alreadyResolved = alreadyResolved
    const fn = reject.bind(obj)
    fn.promise = promise
    fn.alreadyResolved = alreadyResolved
    return {  resolve: _fn, reject: fn }
}

const PromiseResolve = function(C, x){
    if(isPromise(x)){
        let xConstructor = x.constructor
        if(xConstructor === C) return x
    }
    let promiseCapability = NewPromiseCapability(C)
    promiseCapability.resolve(x)
    return promiseCapability.promise
}

const NewPromiseCapability = function(C){
    let resolvingFunctions = { resolve: undefined, reject: undefined }
    let executorClosure = (resolve, reject)=>{
        if(resolvingFunctions.resolve != undefined) throw new TypeError('Promise already resolved')
        if(resolvingFunctions.reject != undefined) throw new TypeError('Promise already rejected')
        resolvingFunctions.resolve = resolve
        resolvingFunctions.reject = reject
    }
    let promise = new C(executorClosure)
    return {
        promise: promise,
        resolve: resolvingFunctions.resolve,
        reject: resolvingFunctions.reject
    }
}

const NewPromiseResolveThenableJob = (promiseToResolve, thenable, then)=>{
    let job = function(){
        let resolvingFunctions = createResolvingFunctions(promiseToResolve)
        let thenCallResult
        try{
            thenCallResult = HostCallJobCallback(then, thenable, resolvingFunctions.resolve, resolvingFunctions.reject)
        }catch(e){
            return resolvingFunctions.reject(e)
        }
        return thenCallResult
    }

    return { job, realm: null }
}

const NewPromiseReactionJob = function(reaction, argument){
    let job = ()=>{
        let handlerResult
        let promiseCapability = reaction.capability
        let type = reaction.type
        let handler = reaction.handler
        if(!!handler){
            let val
            try{
                val = HostCallJobCallback(handler, undefined, argument)
                handlerResult = {  type: FULFILLED, value: val }
            }catch(e){
                handlerResult = {  type: REJECTED, value: e }
            }
        }else{
            if(type == FULFILLED){
                handlerResult = { type: FULFILLED, value: argument }
            }else {
                handlerResult = { type: REJECTED, value: argument }
            }
        }
        if(promiseCapability == undefined){
            return ""
        }
        if(handlerResult.type == FULFILLED){
            // return FulfillPromise(promiseCapability.promise, handlerResult.value)
            return promiseCapability.resolve(handlerResult.value)
        }else{
            // return RejectPromise(promiseCapability.promise, handlerResult.value)
            return promiseCapability.reject(handlerResult.value)
        }
    }
    let handlerRealm = null
    // if(!!reaction.handler){

    // }
    return {
        job: job,
        handlerRealm: handlerRealm
    }
}

const HostCallJobCallback = function(callBack, v, ...args){
    // setTimeout(()=>{
    //     callBack.call(v, ...args)
    // })
    // console.log(...args)
    return callBack.call(v, ...args)
}

const SpeciesConstructor = function(O, defaultConstructor){
    let C = O.constructor
    if(C == undefined) return defaultConstructor
    if(typeof C != 'function') throw new TypeError('C is not an object')
    let S = C[Symbol.species]
    if(S == undefined || S == null) return defaultConstructor
    if(isFunction(S)) return S
    throw new TypeError('SpeciesConstructor is not a constructor')
}

const PerformPromiseThen = function(promise, onFulfilled, onRejected, resultCapability){
    let onFulfilledJobCallback = onRejectedJobCallback = ""
    if(isFunction(onFulfilled)){
        onFulfilledJobCallback = onFulfilled
    }
    if(isFunction(onRejected)){
        onRejectedJobCallback = onRejected
    }
    let fulfillReaction = { capability: resultCapability, type: FULFILLED, handler: onFulfilledJobCallback }
    let rejectReaction = { capability: resultCapability, type: REJECTED, handler: onRejectedJobCallback }
    if(promise.statu === PENDING){
        promise.fulfillReactions.push(fulfillReaction)
        promise.rejectReactions.push(rejectReaction)
    }else if(promise.statu === FULFILLED){
        let value = promise.value
        let fulfillJob = NewPromiseReactionJob(fulfillReaction, value)
        microTask(fulfillJob.job)
    }else{
        let reason = promise.reason || promise.value
        promise.isHandled = false
        let rejectJob = NewPromiseReactionJob(rejectReaction, reason)
        microTask(rejectJob.job)
    }
    promise.isHandled = true
    if(resultCapability == undefined) return undefined
    return resultCapability.promise
}



class MyPromise{

    statu = PENDING
    value = undefined
    reason = undefined
    fulfillReactions = []
    rejectReactions = []
    isHandled = false

    constructor(executor){
        if(!isFunction(executor)) throw new Error("Promise resolver #<Object> is not a function")
        const createResolvingFunction = createResolvingFunctions(this)
        try{
            executor(createResolvingFunction.resolve, createResolvingFunction.reject)
        }catch(e){
            createResolvingFunction.reject(e)
        }
        return this
    }

    finally(){

    }

    resolve(val){
        return PromiseResolve(this, val)
    }

    reject(reason){
        let C = this || MyPromise
        const promiseCapability = NewPromiseCapability(C)
        promiseCapability.reject(reason)
        return promiseCapability.promise
    }

    static all(){}

    static race(){

    }
}

MyPromise.prototype.then = function(onFulfilled, onRejected){
    let promise = this
    if(!isPromise(promise)) throw new TypeError('this is not a promise')
    let C = SpeciesConstructor(this, MyPromise)
    let promiseCapability = NewPromiseCapability(C)
    return PerformPromiseThen(promise, onFulfilled, onRejected, promiseCapability)
}

MyPromise.prototype.catch = function(onRejected){
    return this.then(undefined, onRejected)
}

Object.defineProperty(MyPromise, Symbol.species, {
    get: ()=>{
        return MyPromise
    }
})

const _reject = function(reason){
    let C = this instanceof MyPromise ? this :  MyPromise
    const promiseCapability = NewPromiseCapability(C)
    promiseCapability.reject(reason)
    return promiseCapability.promise
}

const _resolve = function(val){
    let C = this instanceof MyPromise ? this :  MyPromise
    if(isPromise(val)){
        return val
    }
    const promiseCapability = NewPromiseCapability(C)
    promiseCapability.resolve(val)
    return promiseCapability.promise
}

module.exports = {
    deferred: function(){
        return NewPromiseCapability(MyPromise)
    },
    resolve: _resolve,
    reject: _reject
}