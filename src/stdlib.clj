(defn empty? [list] (= (count list) 0))

(defn map [f list]
  (if (empty? list)
    list
    (cons (f (peek list)) (map f (pop list)))))

(defn filter [f list]
  (if (empty? list)
    list
    (let [head (peek list)
          rest (filter f (pop list))]
      (if (f head) 
        (cons head rest)
        rest))))
