import {events} from "../../textData/eventData.js";
const textElement = document.getElementById('modal-text');
const optionButtonsElement = document.getElementById('option-ButtonState');
import Event from '../Events/Event.js';


let state = {}


function startGame() {
    state = {}
    showPassage(1)
}

function showPassage(PassageIndex) {
    const textNode = events.find(textNode => textNode.id === PassageIndex)
    textElement.innerText = textNode.text

    while (optionButtonsElement.firstChild) {
        optionButtonsElement.removeChild(optionButtonsElement.firstChild)
    }


    textNode.options.forEach(option => {
        if (showOption(option)) {
            const button = document.createElement('button')
            button.innerText = option.text
            button.classList.add('option-ButtonState')
            button.addEventListener('click', () => selectOption(option))
            optionButtonsElement.appendChild(button)
        }
    })
}

function showOption(option) {
    return option.requiredState == null || option.requiredState(state)
}

function selectOption(option) {

    const nextTextNodeId = option.nextText
    if (nextTextNodeId === 0) {
        return closeTextModal()
    }
    state = Object.assign(state, option.setState)
    showPassage(nextTextNodeId)
}

const closeTextModal = () => {
 document.getElementById('modal-passage').style.display = 'none'
};

export default startGame;

//Erinevate komponentide näitamiseks id numbrid
//Map komponendi näitamine on id 0
