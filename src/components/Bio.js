import React from 'react'

// Import typefaces
import 'typeface-montserrat'
import 'typeface-merriweather'

import profilePic from './profile-pic.jpg'
import { rhythm } from '../utils/typography'

class Bio extends React.Component {
  render() {
    return (
      <div
        style={{
          display: 'flex',
          marginBottom: rhythm(2.5),
        }}
      >
        <img
          src={profilePic}
          alt={`yanxingzhe`}
          style={{
            marginRight: rhythm(1 / 2),
            marginBottom: 0,
            width: rhythm(4),
            height: rhythm(4),
            borderRadius: rhythm(4)
          }}
        />
        <p>
          作者：<strong>杨夏燕</strong>，花名：燕行者<br/>
          工作经历：拼多多（2018.7至今），百度（2014.11-2018.7）<br/>
          住址：上海市长宁区<br/>
        </p>
      </div>
    )
  }
}

export default Bio
